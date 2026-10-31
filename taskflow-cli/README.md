# TaskFlow CLI — Rust Edition

Terminal port of the TaskFlow to-do web app (`app.js` in the parent folder).
Same features: title/description/due date/priority, search, filters, sorting,
stats, undo, clear-completed, JSON export/import. localStorage → `tasks.json`.

## Run

```bash
cargo run
```

## Commands

```
add <title> [--desc=...] [--due=YYYY-MM-DD] [--p=high|medium|low]
list [all|active|done] [--p=<priority>] [--when=today|week|overdue] [--sort=due|priority|title]
done <id> · undone <id> · edit <id> [--title=...] [--due=...] [--p=...]
rm <id> · undo · search <text> · clear done · stats
export [file] · import <file> · help · quit
```

Overdue tasks show in red, due-today in yellow. The web app in the parent
folder is untouched.
