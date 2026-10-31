//! TaskFlow CLI — Rust terminal port of the TaskFlow web app
//! (`app.js` in the parent folder): tasks with title/description/due date/
//! priority, search, filters, sorting, stats, undo, clear-completed,
//! JSON export/import. localStorage is replaced by tasks.json.
//!
//! Run with `cargo run` and type `help`.

use std::io::{self, BufRead, Write};

use chrono::{Datelike, Duration, Local};
use serde::{Deserialize, Serialize};

const STORE_FILE: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/tasks.json");

const RED: &str = "\x1b[31m";
const GREEN: &str = "\x1b[32m";
const YELLOW: &str = "\x1b[33m";
const CYAN: &str = "\x1b[36m";
const DIM: &str = "\x1b[2m";
const BOLD: &str = "\x1b[1m";
const RESET: &str = "\x1b[0m";

#[derive(Serialize, Deserialize, Clone)]
struct Task {
    id: u64,
    title: String,
    #[serde(default)]
    desc: String,
    #[serde(default)]
    due: String, // "YYYY-MM-DD" or ""
    #[serde(default = "default_priority")]
    priority: String, // high | medium | low
    #[serde(default)]
    done: bool,
    created: String, // "YYYY-MM-DD"
}

fn default_priority() -> String {
    "medium".to_string()
}

#[derive(Serialize, Deserialize, Default)]
struct Store {
    #[serde(default)]
    next_id: u64,
    #[serde(default)]
    tasks: Vec<Task>,
}

fn today_str() -> String {
    Local::now().date_naive().format("%Y-%m-%d").to_string()
}

fn end_of_week_str() -> String {
    let now = Local::now().date_naive();
    (now + Duration::days(7 - now.weekday().num_days_from_sunday() as i64))
        .format("%Y-%m-%d")
        .to_string()
}

fn load() -> Store {
    std::fs::read_to_string(STORE_FILE)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save(store: &Store) {
    if let Ok(json) = serde_json::to_string_pretty(store) {
        let _ = std::fs::write(STORE_FILE, json);
    }
}

fn prio_tag(p: &str) -> String {
    match p {
        "high" => format!("{RED}⚑ high{RESET}"),
        "low" => format!("{DIM}⚑ low{RESET}"),
        _ => format!("{YELLOW}⚑ medium{RESET}"),
    }
}

fn due_display(task: &Task, today: &str) -> String {
    if task.due.is_empty() {
        return String::new();
    }
    if task.done {
        return format!("{DIM}due {}{RESET}", task.due);
    }
    if task.due.as_str() < today {
        return format!("{RED}due {} (overdue){RESET}", task.due);
    }
    if task.due == today {
        return format!("{YELLOW}due {} (today){RESET}", task.due);
    }
    format!("due {}", task.due)
}

fn truncate(s: &str, width: usize) -> String {
    if s.chars().count() <= width {
        format!("{:<width$}", s, width = width)
    } else {
        let cut: String = s.chars().take(width - 1).collect();
        format!("{cut}…")
    }
}

fn find_task<'a>(store: &'a Store, id: u64) -> Option<&'a Task> {
    store.tasks.iter().find(|t| t.id == id)
}

fn find_task_mut<'a>(store: &'a mut Store, id: u64) -> Option<&'a mut Task> {
    store.tasks.iter_mut().find(|t| t.id == id)
}

/// Very small flag parser: pulls `--key=value` tokens out of the argument list.
fn take_flags(args: &[String], keys: &[&str]) -> (Vec<String>, std::collections::HashMap<String, String>) {
    let mut rest = Vec::new();
    let mut flags = std::collections::HashMap::new();
    for arg in args {
        if let Some(stripped) = arg.strip_prefix("--") {
            if let Some((k, v)) = stripped.split_once('=') {
                if keys.contains(&k) {
                    flags.insert(k.to_string(), v.to_string());
                    continue;
                }
            }
        }
        rest.push(arg.clone());
    }
    (rest, flags)
}

fn print_help() {
    println!(
        "{BOLD}TaskFlow CLI{RESET} — to-do list in the terminal
{DIM}data lives in tasks.json{RESET}

  add <title> [--desc=...] [--due=YYYY-MM-DD] [--p=high|medium|low]
  list [all|active|done] [--p=<priority>] [--when=today|week|overdue] [--sort=due|priority|title]
  done <id>            undone <id>
  edit <id> [--title=...] [--desc=...] [--due=...] [--p=...]
  rm <id>              delete one task ({GREEN}undo{RESET} restores it)
  undo                 restore the last deleted task
  search <text>        search in title + description
  clear done           remove all completed tasks
  stats                counts
  export [file]        save tasks to JSON
  import <file>        load tasks from JSON (merged)
  help                 this text
  quit"
    );
}

fn print_list(tasks: &[&Task], today: &str) {
    if tasks.is_empty() {
        println!("{DIM}Nothing here. Add one with: add <title>{RESET}");
        return;
    }
    for t in tasks {
        let (mark, mark_color) = if t.done { ("x", GREEN) } else { (" ", CYAN) };
        println!(
            " {mark_color}[{mark}]{RESET} {:<3} {}  {}  {}",
            t.id,
            truncate(&t.title, 34),
            due_display(t, today),
            prio_tag(&t.priority),
        );
    }
}

fn apply_sort(tasks: &mut Vec<&Task>, sort: Option<&String>, today: &str) {
    match sort.map(|s| s.as_str()) {
        Some("due") => tasks.sort_by(|a, b| a.due.cmp(&b.due)),
        Some("title") => tasks.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase())),
        Some("priority") => {
            let rank = |p: &str| match p {
                "high" => 0,
                "medium" => 1,
                _ => 2,
            };
            tasks.sort_by_key(|t| rank(&t.priority));
        }
        _ => tasks.sort_by(|a, b| a.id.cmp(&b.id)), // creation order
    }
    let _ = today;
}

fn main() {
    println!("{BOLD}✅ TaskFlow CLI{RESET} — type {CYAN}help{RESET} for commands");
    let mut store = load();
    let mut last_deleted: Option<Task> = None;
    let stdin = io::stdin();

    loop {
        print!("{CYAN}taskflow>{RESET} ");
        let _ = io::stdout().flush();
        let mut line = String::new();
        if stdin.lock().read_line(&mut line).unwrap_or(0) == 0 {
            break; // EOF
        }
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let mut parts = line.split_whitespace().map(|s| s.to_string());
        let cmd = parts.next().unwrap_or_default();
        let args: Vec<String> = parts.collect();
        let today = today_str();
        let mut changed = false;

        match cmd.as_str() {
            "quit" | "exit" | "q" => {
                println!("Bye! 👋");
                break;
            }
            "help" | "?" => print_help(),
            "add" => {
                let (rest, flags) = take_flags(
                    &args,
                    &["desc", "due", "p", "priority", "title"],
                );
                let title = match flags.get("title") {
                    Some(t) => t.clone(),
                    None => rest.join(" "),
                };
                if title.trim().is_empty() {
                    println!("{RED}Usage: add <title> [--desc=...] [--due=YYYY-MM-DD] [--p=high|medium|low]{RESET}");
                    continue;
                }
                let priority = flags
                    .get("p")
                    .or_else(|| flags.get("priority"))
                    .map(|p| p.to_lowercase())
                    .unwrap_or_else(default_priority);
                if !["high", "medium", "low"].contains(&priority.as_str()) {
                    println!("{RED}priority must be high, medium or low{RESET}");
                    continue;
                }
                let due = flags.get("due").cloned().unwrap_or_default();
                store.next_id += 1;
                let task = Task {
                    id: store.next_id,
                    title: title.trim().to_string(),
                    desc: flags.get("desc").cloned().unwrap_or_default(),
                    due,
                    priority,
                    done: false,
                    created: today.clone(),
                };
                println!("{GREEN}Added #{id}{RESET} — {title}", id = task.id, title = task.title);
                last_deleted = None;
                store.tasks.push(task);
                changed = true;
            }
            "list" | "ls" => {
                let (rest, flags) = take_flags(&args, &["p", "when", "sort"]);
                let view = rest.first().map(|s| s.as_str()).unwrap_or("all");
                let mut selected: Vec<&Task> = store
                    .tasks
                    .iter()
                    .filter(|t| match view {
                        "active" => !t.done,
                        "done" => t.done,
                        _ => true,
                    })
                    .filter(|t| match flags.get("p").map(|s| s.as_str()) {
                        Some(p) => t.priority == p,
                        None => true,
                    })
                    .filter(|t| match flags.get("when").map(|s| s.as_str()) {
                        Some("today") => t.due == today,
                        Some("week") => !t.due.is_empty() && t.due <= end_of_week_str(),
                        Some("overdue") => !t.done && !t.due.is_empty() && t.due < today,
                        _ => true,
                    })
                    .collect();
                apply_sort(&mut selected, flags.get("sort"), &today);
                let total = selected.len();
                let done = selected.iter().filter(|t| t.done).count();
                print_list(&selected, &today);
                println!("{DIM}{total} task(s), {done} completed{RESET}");
            }
            "done" => {
                let id: u64 = match args.first().and_then(|s| s.parse().ok()) {
                    Some(v) => v,
                    None => {
                        println!("{RED}Usage: done <id>{RESET}");
                        continue;
                    }
                };
                match find_task_mut(&mut store, id) {
                    Some(t) if !t.done => {
                        t.done = true;
                        println!("{GREEN}✔ Completed:{RESET} {}", t.title);
                        changed = true;
                    }
                    Some(t) => println!("Already done: {}", t.title),
                    None => println!("{RED}No task #{id}{RESET}"),
                }
            }
            "undone" | "reopen" => {
                let id: u64 = match args.first().and_then(|s| s.parse().ok()) {
                    Some(v) => v,
                    None => {
                        println!("{RED}Usage: undone <id>{RESET}");
                        continue;
                    }
                };
                match find_task_mut(&mut store, id) {
                    Some(t) if t.done => {
                        t.done = false;
                        println!("Reopened: {}", t.title);
                        changed = true;
                    }
                    Some(t) => println!("Not done yet: {}", t.title),
                    None => println!("{RED}No task #{id}{RESET}"),
                }
            }
            "edit" => {
                let (rest, flags) = take_flags(&args, &["title", "desc", "due", "p"]);
                let id: u64 = match rest.first().and_then(|s| s.parse().ok()) {
                    Some(v) => v,
                    None => {
                        println!("{RED}Usage: edit <id> [--title=...] [--desc=...] [--due=...] [--p=...]{RESET}");
                        continue;
                    }
                };
                match find_task_mut(&mut store, id) {
                    Some(t) => {
                        if let Some(title) = flags.get("title") {
                            t.title = title.clone();
                        }
                        if let Some(desc) = flags.get("desc") {
                            t.desc = desc.clone();
                        }
                        if let Some(due) = flags.get("due") {
                            t.due = due.clone();
                        }
                        if let Some(p) = flags.get("p") {
                            let p = p.to_lowercase();
                            if ["high", "medium", "low"].contains(&p.as_str()) {
                                t.priority = p;
                            } else {
                                println!("{RED}priority must be high, medium or low{RESET}");
                                continue;
                            }
                        }
                        println!("Updated #{id}: {}", t.title);
                        changed = true;
                    }
                    None => println!("{RED}No task #{id}{RESET}"),
                }
            }
            "rm" | "delete" => {
                let id: u64 = match args.first().and_then(|s| s.parse().ok()) {
                    Some(v) => v,
                    None => {
                        println!("{RED}Usage: rm <id>{RESET}");
                        continue;
                    }
                };
                match store.tasks.iter().position(|t| t.id == id) {
                    Some(pos) => {
                        let task = store.tasks.remove(pos);
                        println!("{YELLOW}Deleted{RESET} #{id}: {} {DIM}(undo restores it){RESET}", task.title);
                        last_deleted = Some(task);
                        changed = true;
                    }
                    None => println!("{RED}No task #{id}{RESET}"),
                }
            }
            "undo" => match last_deleted.take() {
                Some(task) => {
                    println!("{GREEN}Restored{RESET} #{id}: {title}", id = task.id, title = task.title);
                    store.tasks.push(task);
                    changed = true;
                }
                None => println!("Nothing to undo."),
            },
            "search" | "find" => {
                let q = args.join(" ").to_lowercase();
                if q.is_empty() {
                    println!("{RED}Usage: search <text>{RESET}");
                    continue;
                }
                let hits: Vec<&Task> = store
                    .tasks
                    .iter()
                    .filter(|t| {
                        t.title.to_lowercase().contains(&q) || t.desc.to_lowercase().contains(&q)
                    })
                    .collect();
                print_list(&hits, &today);
            }
            "clear" => {
                if args.first().map(|s| s.as_str()) == Some("done") {
                    let before = store.tasks.len();
                    store.tasks.retain(|t| !t.done);
                    println!("Removed {} completed task(s).", before - store.tasks.len());
                    last_deleted = None;
                    changed = true;
                } else {
                    println!("{RED}Usage: clear done{RESET}");
                }
            }
            "stats" => {
                let total = store.tasks.len();
                let done = store.tasks.iter().filter(|t| t.done).count();
                let overdue = store
                    .tasks
                    .iter()
                    .filter(|t| !t.done && !t.due.is_empty() && t.due < today)
                    .count();
                println!(
                    "📋 {total} total · {GREEN}{done} completed{RESET} · {CYAN}{} active{RESET} · {RED}{overdue} overdue{RESET}",
                    total - done
                );
            }
            "export" => {
                let path = args
                    .first()
                    .cloned()
                    .unwrap_or_else(|| "taskflow-export.json".to_string());
                match serde_json::to_string_pretty(&store.tasks) {
                    Ok(json) => match std::fs::write(&path, json) {
                        Ok(_) => println!("Exported {} task(s) to {path}.", store.tasks.len()),
                        Err(e) => println!("{RED}Write failed: {e}{RESET}"),
                    },
                    Err(e) => println!("{RED}Serialize failed: {e}{RESET}"),
                }
            }
            "import" => {
                let path = match args.first() {
                    Some(p) => p.clone(),
                    None => {
                        println!("{RED}Usage: import <file>{RESET}");
                        continue;
                    }
                };
                match std::fs::read_to_string(&path)
                    .ok()
                    .and_then(|s| serde_json::from_str::<Vec<Task>>(&s).ok())
                {
                    Some(tasks) => {
                        let n = tasks.len();
                        for mut t in tasks {
                            store.next_id += 1;
                            t.id = store.next_id;
                            store.tasks.push(t);
                        }
                        println!("Imported {n} task(s) from {path}.");
                        changed = true;
                    }
                    None => println!("{RED}Could not read a task list from {path}{RESET}"),
                }
            }
            unknown => {
                println!("{RED}Unknown command '{unknown}'{RESET} — type help");
                continue;
            }
        }

        if changed {
            save(&store);
        }
    }
}
