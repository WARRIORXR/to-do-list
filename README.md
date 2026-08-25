# ✨ TaskFlow — Smart To-Do List

A premium, fully responsive To-Do List application built with vanilla HTML, CSS & JavaScript. Features task management with priorities, smart filtering, real-time search, dark mode, and local storage persistence — all with zero dependencies.

![TaskFlow Light Mode](https://img.shields.io/badge/Mode-Light-f0f2f5?style=for-the-badge)
![TaskFlow Dark Mode](https://img.shields.io/badge/Mode-Dark-0f1117?style=for-the-badge)
![No Dependencies](https://img.shields.io/badge/Dependencies-Zero-22c55e?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-6366f1?style=for-the-badge)

---

## 🚀 Live Demo

🔗 **[Try TaskFlow Live →](https://to-do-list-gray-alpha-39.vercel.app/)**

---

## 📋 Features

### Task Management
- **Add** tasks with title, description, due date & priority
- **Edit** any task — form transitions to edit mode with visual glow
- **Delete** with confirmation modal + **5-second undo** toast
- **Bulk delete** all completed tasks
- Form validation prevents empty task titles

### Status & Completion
- Checkbox toggle for complete / incomplete
- Strike-through text + dimmed opacity for completed tasks
- Completion timestamp displayed (e.g., *"Aug 25 4:44 PM"*)

### Filtering & Sorting
| Filter Type | Options |
|-------------|---------|
| **Status** | All · Active · Completed (with live counts) |
| **Priority** | All · High · Medium · Low |
| **Due Date** | All · Due Today · This Week · Overdue |
| **Sort** | Newest First · Oldest First · Priority · Due Date ↑↓ |

> All filters combine with each other for precise task views.

### Priority System
| Level | Color | Visual |
|-------|-------|--------|
| 🔴 High | Red | Red badge + red left border stripe |
| 🟡 Medium | Orange | Orange badge + orange stripe |
| 🔵 Low | Indigo | Blue badge + indigo stripe |

### Search
- Real-time filtering as you type
- Searches both **title** and **description**
- Matching text highlighted with `<mark>` tags
- Clear button & "No results found" state

### Dark Mode
- Toggle via sun/moon icon in header
- Theme preference saved to `localStorage`
- Full dark color palette with smooth CSS transitions

### Data Persistence
- **Auto-save** to `localStorage` on every change
- Tasks survive page refresh and browser restart
- **Export** tasks as a `.json` backup file
- **Import** tasks from a `.json` file
- **Clear all data** with confirmation modal

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **HTML5** | Semantic structure, accessibility (`role`, `aria-*`) |
| **CSS3** | Custom properties, flexbox, grid, animations, `backdrop-filter` |
| **JavaScript** | Vanilla ES6+ (IIFE module pattern, no frameworks) |
| **Google Fonts** | [Inter](https://fonts.google.com/specimen/Inter) typeface |
| **localStorage** | Client-side data persistence |

---

## 📁 Project Structure

```
to-do-list/
├── index.html    # Main HTML — layout, modals, form, task list
├── style.css     # Design system — variables, dark mode, animations
├── app.js        # Application logic — CRUD, filters, search, storage
└── README.md     # Documentation
```

---

## 🎨 Design Highlights

- **Glassmorphism header** with `backdrop-filter: blur(16px)`
- **Priority color stripes** on task cards (left border)
- **Slide-in animations** for new tasks
- **Slide-out animations** for deleted tasks
- **Gradient brand logo** and primary buttons
- **Focus glow rings** on interactive elements
- **Responsive layout** — stacks gracefully at 600px

---

## ⚡ Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/WARRIORXR/to-do-list.git
   ```

2. **Open in browser**
   ```bash
   cd to-do-list
   start index.html        # Windows
   open index.html          # macOS
   xdg-open index.html      # Linux
   ```

3. **Start adding tasks!**

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Escape` | Close modal / exit edit mode |
| `Tab` | Navigate between form fields |

---

## 📤 Export & Import

- Click the **↓ download icon** in the header to export all tasks as `taskflow_backup_YYYY-MM-DD.json`
- Click the **↑ upload icon** to import tasks from a previously exported JSON file

---

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<p align="center">
  Built with ❤️ using vanilla HTML, CSS & JavaScript
</p>
