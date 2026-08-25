/* ============================================================
   TaskFlow — Application Logic
   ============================================================ */

(function () {
  'use strict';

  // ── State ──
  let tasks = [];
  let editingId = null;
  let deletedTask = null;
  let undoTimer = null;

  // ── DOM Refs ──
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    form: $('#task-form'),
    titleInput: $('#task-title'),
    descInput: $('#task-desc'),
    dueInput: $('#task-due'),
    priorityInput: $('#task-priority'),
    titleError: $('#title-error'),
    formTitle: $('#form-title'),
    formCancel: $('#form-cancel'),
    formSubmit: $('#form-submit'),
    formSubmitText: $('#form-submit-text'),
    searchInput: $('#search-input'),
    searchClear: $('#search-clear'),
    taskList: $('#task-list'),
    emptyState: $('#empty-state'),
    emptyTitle: $('#empty-title'),
    emptySubtitle: $('#empty-subtitle'),
    filterBtns: $$('.filter-btn'),
    filterPriority: $('#filter-priority'),
    filterDate: $('#filter-date'),
    sortBy: $('#sort-by'),
    countAll: $('#count-all'),
    countActive: $('#count-active'),
    countCompleted: $('#count-completed'),
    statsActive: $('#stats-active'),
    statsCompleted: $('#stats-completed'),
    clearCompletedBtn: $('#clear-completed-btn'),
    clearAllBtn: $('#clear-all-btn'),
    themeToggle: $('#theme-toggle'),
    exportBtn: $('#export-btn'),
    importBtn: $('#import-btn'),
    importFile: $('#import-file'),
    deleteModal: $('#delete-modal'),
    modalTitle: $('#modal-title'),
    modalMessage: $('#modal-message'),
    modalCancel: $('#modal-cancel'),
    modalConfirm: $('#modal-confirm'),
    undoToast: $('#undo-toast'),
    undoMessage: $('#undo-message'),
    undoBtn: $('#undo-btn'),
    undoTimerBar: $('#undo-timer-bar'),
  };

  // ── Helpers ──
  const genId = () => '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function endOfWeekStr() {
    const d = new Date();
    d.setDate(d.getDate() + (7 - d.getDay()));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatTimestamp(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function highlightText(text, query) {
    if (!query) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<mark class="highlight">$1</mark>');
  }

  // ── Local Storage ──
  function saveTasks() {
    try {
      localStorage.setItem('taskflow_tasks', JSON.stringify(tasks));
    } catch (e) { /* quota exceeded */ }
  }

  function loadTasks() {
    try {
      const raw = localStorage.getItem('taskflow_tasks');
      if (raw) tasks = JSON.parse(raw);
    } catch { tasks = []; }
  }

  // ── Theme ──
  function initTheme() {
    const saved = localStorage.getItem('taskflow_theme');
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  }

  function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('taskflow_theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('taskflow_theme', 'dark');
    }
  }

  // ── Due-date classification ──
  function dueDateClass(dateStr, isCompleted) {
    if (!dateStr || isCompleted) return '';
    const today = todayStr();
    if (dateStr === today) return 'due-today';
    if (dateStr < today) return 'overdue';
    return 'due';
  }

  function dueDateLabel(dateStr, isCompleted) {
    if (!dateStr) return '';
    if (isCompleted) return formatDate(dateStr);
    const today = todayStr();
    if (dateStr === today) return 'Due Today';
    if (dateStr < today) return 'Overdue · ' + formatDate(dateStr);
    return formatDate(dateStr);
  }

  // ── Filtering & Sorting ──
  function getActiveFilter() {
    const active = document.querySelector('.filter-btn.active');
    return active ? active.dataset.filter : 'all';
  }

  function getFilteredTasks() {
    const statusFilter = getActiveFilter();
    const priorityFilter = dom.filterPriority.value;
    const dateFilter = dom.filterDate.value;
    const query = dom.searchInput.value.trim().toLowerCase();
    const today = todayStr();
    const weekEnd = endOfWeekStr();

    let list = tasks.filter((t) => {
      // Status
      if (statusFilter === 'active' && t.completed) return false;
      if (statusFilter === 'completed' && !t.completed) return false;

      // Priority
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;

      // Date
      if (dateFilter === 'today' && t.dueDate !== today) return false;
      if (dateFilter === 'week' && (!t.dueDate || t.dueDate > weekEnd || t.dueDate < today)) return false;
      if (dateFilter === 'overdue' && (!t.dueDate || t.dueDate >= today || t.completed)) return false;

      // Search
      if (query) {
        const inTitle = t.title.toLowerCase().includes(query);
        const inDesc = (t.description || '').toLowerCase().includes(query);
        if (!inTitle && !inDesc) return false;
      }

      return true;
    });

    // Sort
    const sortVal = dom.sortBy.value;
    const priorityOrder = { high: 0, medium: 1, low: 2 };

    list.sort((a, b) => {
      switch (sortVal) {
        case 'created-desc': return b.createdAt - a.createdAt;
        case 'created-asc': return a.createdAt - b.createdAt;
        case 'priority': return priorityOrder[a.priority] - priorityOrder[b.priority];
        case 'due-asc':
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        case 'due-desc':
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return b.dueDate.localeCompare(a.dueDate);
        default: return 0;
      }
    });

    return list;
  }

  // ── Render ──
  function render() {
    const filtered = getFilteredTasks();
    const query = dom.searchInput.value.trim();
    const totalActive = tasks.filter((t) => !t.completed).length;
    const totalCompleted = tasks.filter((t) => t.completed).length;

    // Counts
    dom.countAll.textContent = tasks.length;
    dom.countActive.textContent = totalActive;
    dom.countCompleted.textContent = totalCompleted;
    dom.statsActive.innerHTML = `<strong>${totalActive}</strong> active`;
    dom.statsCompleted.innerHTML = `<strong>${totalCompleted}</strong> completed`;

    // Clear completed button
    dom.clearCompletedBtn.hidden = totalCompleted === 0;

    // Empty state — always set both branches explicitly
    const hasFiltered = filtered.length > 0;
    dom.emptyState.hidden = hasFiltered;
    dom.emptyState.style.display = hasFiltered ? 'none' : '';

    if (!hasFiltered) {
      dom.taskList.innerHTML = '';
      if (tasks.length === 0) {
        dom.emptyTitle.textContent = 'No tasks yet';
        dom.emptySubtitle.textContent = 'Add your first task above to get started!';
      } else if (query) {
        dom.emptyTitle.textContent = 'No results found';
        dom.emptySubtitle.textContent = `No tasks match "${query}"`;
      } else {
        dom.emptyTitle.textContent = 'No tasks match filters';
        dom.emptySubtitle.textContent = 'Try adjusting your filter criteria.';
      }
      return;
    }

    dom.taskList.innerHTML = filtered.map((task) => {
      const dueClass = dueDateClass(task.dueDate, task.completed);
      const dueLabel = dueDateLabel(task.dueDate, task.completed);
      const title = highlightText(task.title, query);
      const desc = task.description ? highlightText(task.description, query) : '';

      return `
        <div class="task-item ${task.completed ? 'completed' : ''}"
             data-id="${task.id}"
             data-priority="${task.priority}"
             role="listitem">
          <label class="task-checkbox">
            <input type="checkbox" ${task.completed ? 'checked' : ''} aria-label="Toggle complete" />
            <span class="check-visual">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
          </label>
          <div class="task-body">
            <div class="task-title">${title}</div>
            ${desc ? `<div class="task-desc">${desc}</div>` : ''}
            <div class="task-meta">
              <span class="meta-tag ${task.priority}">${task.priority}</span>
              ${dueLabel ? `<span class="meta-tag ${dueClass}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                ${dueLabel}
              </span>` : ''}
              ${task.completed && task.completedAt ? `<span class="meta-tag completed-tag">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                ${formatTimestamp(task.completedAt)}
              </span>` : ''}
            </div>
          </div>
          <div class="task-actions">
            <button class="task-action-btn edit" title="Edit task" aria-label="Edit task">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="task-action-btn delete" title="Delete task" aria-label="Delete task">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            </button>
          </div>
        </div>`;
    }).join('');
  }

  // ── Add / Edit Task ──
  function handleSubmit(e) {
    e.preventDefault();
    const title = dom.titleInput.value.trim();
    if (!title) {
      dom.titleError.hidden = false;
      dom.titleInput.focus();
      return;
    }
    dom.titleError.hidden = true;

    if (editingId) {
      // Update existing
      const task = tasks.find((t) => t.id === editingId);
      if (task) {
        task.title = title;
        task.description = dom.descInput.value.trim();
        task.dueDate = dom.dueInput.value || '';
        task.priority = dom.priorityInput.value;
        task.updatedAt = Date.now();
      }
      exitEditMode();
    } else {
      // New task
      tasks.push({
        id: genId(),
        title,
        description: dom.descInput.value.trim(),
        dueDate: dom.dueInput.value || '',
        priority: dom.priorityInput.value,
        completed: false,
        completedAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    clearForm();
    saveTasks();
    render();
  }

  function clearForm() {
    dom.titleInput.value = '';
    dom.descInput.value = '';
    dom.dueInput.value = '';
    dom.priorityInput.value = 'medium';
    dom.titleError.hidden = true;
  }

  // ── Edit Mode ──
  function enterEditMode(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    editingId = id;
    dom.titleInput.value = task.title;
    dom.descInput.value = task.description || '';
    dom.dueInput.value = task.dueDate || '';
    dom.priorityInput.value = task.priority;
    dom.formTitle.textContent = 'Edit Task';
    dom.formSubmitText.textContent = 'Save Changes';
    dom.formCancel.hidden = false;
    dom.form.classList.add('editing');
    dom.form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    dom.titleInput.focus();
  }

  function exitEditMode() {
    editingId = null;
    dom.formTitle.textContent = 'New Task';
    dom.formSubmitText.textContent = 'Add Task';
    dom.formCancel.hidden = true;
    dom.form.classList.remove('editing');
  }

  // ── Delete ──
  let pendingDeleteId = null;
  let pendingDeleteType = null; // 'single' | 'completed' | 'all'

  function showModal(title, message, type, id) {
    dom.modalTitle.textContent = title;
    dom.modalMessage.textContent = message;
    pendingDeleteType = type;
    pendingDeleteId = id || null;
    dom.deleteModal.classList.add('open');
  }

  function hideModal() {
    dom.deleteModal.classList.remove('open');
    pendingDeleteId = null;
    pendingDeleteType = null;
  }

  function confirmDelete() {
    if (pendingDeleteType === 'single' && pendingDeleteId) {
      const idx = tasks.findIndex((t) => t.id === pendingDeleteId);
      if (idx !== -1) {
        deletedTask = { task: tasks[idx], index: idx };
        tasks.splice(idx, 1);
        showUndoToast('Task deleted.');
      }
    } else if (pendingDeleteType === 'completed') {
      const removed = tasks.filter((t) => t.completed);
      deletedTask = { bulk: removed };
      tasks = tasks.filter((t) => !t.completed);
      showUndoToast(`${removed.length} completed task${removed.length > 1 ? 's' : ''} deleted.`);
    } else if (pendingDeleteType === 'all') {
      deletedTask = { bulk: [...tasks] };
      tasks = [];
      showUndoToast('All tasks cleared.');
    }

    // If we were editing a deleted task, exit edit mode
    if (editingId && !tasks.find((t) => t.id === editingId)) {
      exitEditMode();
      clearForm();
    }

    hideModal();
    saveTasks();
    render();
  }

  // ── Undo Toast ──
  function showUndoToast(msg) {
    clearTimeout(undoTimer);
    dom.undoMessage.textContent = msg;
    dom.undoToast.classList.add('show');
    // Restart animation
    dom.undoTimerBar.style.animation = 'none';
    // Force reflow
    void dom.undoTimerBar.offsetWidth;
    dom.undoTimerBar.style.animation = 'timerShrink 5s linear forwards';

    undoTimer = setTimeout(() => {
      dom.undoToast.classList.remove('show');
      deletedTask = null;
    }, 5000);
  }

  function handleUndo() {
    if (!deletedTask) return;
    clearTimeout(undoTimer);
    dom.undoToast.classList.remove('show');

    if (deletedTask.task) {
      tasks.splice(deletedTask.index, 0, deletedTask.task);
    } else if (deletedTask.bulk) {
      tasks = tasks.concat(deletedTask.bulk);
    }

    deletedTask = null;
    saveTasks();
    render();
  }

  // ── Toggle Complete ──
  function toggleComplete(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    task.completedAt = task.completed ? Date.now() : null;
    task.updatedAt = Date.now();
    saveTasks();
    render();
  }

  // ── Task List Event Delegation ──
  function handleTaskListClick(e) {
    const item = e.target.closest('.task-item');
    if (!item) return;
    const id = item.dataset.id;

    // Checkbox
    if (e.target.closest('.task-checkbox')) {
      toggleComplete(id);
      return;
    }

    // Edit
    if (e.target.closest('.task-action-btn.edit')) {
      enterEditMode(id);
      return;
    }

    // Delete
    if (e.target.closest('.task-action-btn.delete')) {
      const task = tasks.find((t) => t.id === id);
      showModal('Delete Task?', `"${task ? task.title : 'this task'}" will be removed.`, 'single', id);
      return;
    }
  }

  // ── Filters ──
  function setStatusFilter(filter) {
    dom.filterBtns.forEach((btn) => {
      const isActive = btn.dataset.filter === filter;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive);
    });
    render();
  }

  // ── Search ──
  function handleSearch() {
    const val = dom.searchInput.value.trim();
    dom.searchClear.hidden = !val;
    render();
  }

  // ── Export / Import ──
  function exportTasks() {
    const data = JSON.stringify(tasks, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskflow_backup_${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importTasks(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (Array.isArray(imported)) {
          tasks = imported;
          saveTasks();
          render();
        } else {
          alert('Invalid file format. Expected a JSON array of tasks.');
        }
      } catch {
        alert('Could not parse the file. Please select a valid JSON file.');
      }
    };
    reader.readAsText(file);
    dom.importFile.value = ''; // reset
  }

  // ── Event Bindings ──
  function bindEvents() {
    // Form
    dom.form.addEventListener('submit', handleSubmit);
    dom.formCancel.addEventListener('click', () => { exitEditMode(); clearForm(); });
    dom.titleInput.addEventListener('input', () => { dom.titleError.hidden = true; });

    // Search
    dom.searchInput.addEventListener('input', handleSearch);
    dom.searchClear.addEventListener('click', () => {
      dom.searchInput.value = '';
      dom.searchClear.hidden = true;
      render();
      dom.searchInput.focus();
    });

    // Filters
    dom.filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => setStatusFilter(btn.dataset.filter));
    });
    dom.filterPriority.addEventListener('change', render);
    dom.filterDate.addEventListener('change', render);
    dom.sortBy.addEventListener('change', render);

    // Task list
    dom.taskList.addEventListener('click', handleTaskListClick);

    // Footer
    dom.clearCompletedBtn.addEventListener('click', () => {
      const count = tasks.filter((t) => t.completed).length;
      showModal('Delete Completed?', `${count} completed task${count > 1 ? 's' : ''} will be removed.`, 'completed');
    });
    dom.clearAllBtn.addEventListener('click', () => {
      if (tasks.length === 0) return;
      showModal('Clear All Data?', `All ${tasks.length} task${tasks.length > 1 ? 's' : ''} will be permanently removed.`, 'all');
    });

    // Modal
    dom.modalCancel.addEventListener('click', hideModal);
    dom.modalConfirm.addEventListener('click', confirmDelete);
    dom.deleteModal.addEventListener('click', (e) => {
      if (e.target === dom.deleteModal) hideModal();
    });

    // Undo
    dom.undoBtn.addEventListener('click', handleUndo);

    // Theme
    dom.themeToggle.addEventListener('click', toggleTheme);

    // Export / Import
    dom.exportBtn.addEventListener('click', exportTasks);
    dom.importBtn.addEventListener('click', () => dom.importFile.click());
    dom.importFile.addEventListener('change', importTasks);

    // Keyboard: Escape to close modal or exit edit
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (dom.deleteModal.classList.contains('open')) {
          hideModal();
        } else if (editingId) {
          exitEditMode();
          clearForm();
        }
      }
    });
  }

  // ── Init ──
  function init() {
    initTheme();
    loadTasks();
    bindEvents();
    render();
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
