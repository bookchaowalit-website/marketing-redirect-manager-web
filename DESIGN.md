# Design

Since 2026-11-19 this app uses the shared **App shell**: rules, pieces and the move recipe are in
[`APP-SHELL.md`](APP-SHELL.md). The earlier one-off look ("Forwarding Desk", paper and stamps) was retired so every
list app on `*.bookchaowalit.com` reads the same way; see git history for its old design notes.

Layout: the sidebar lists the rules by status code (All, 301, 302, 307) with counts; the head has search and the one
filled "New rule" button; the composer opens in place (from path with Generate short path, destination, status as a
segmented control); rows show `from → to` in mono with a status pill and a Remove that can be undone. Under the list
a "Check a path" card shows where an exact path goes. App-specific CSS (prefix `rm-`) covers mono paths, the red
field error placed under the field it is about (with `aria-invalid` and `aria-describedby`), and the checker card.
