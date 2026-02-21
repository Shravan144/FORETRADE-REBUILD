# Push This Project to Your GitHub Repo

Do this **when you're ready** (e.g. after 30–35 mins of work). Your repo is already created but empty.

---

## Step 1: Open terminal in the project

- Go to your project folder: `c:\Users\Public\foretrade`
- Open Terminal (Cursor: **Terminal → New Terminal**)

---

## Step 2: Initialize Git (only if this folder is not a git repo yet)

Run:

```bash
git init
```

*(If you see "Reinitialized existing Git repository", that's fine — skip to Step 3.)*

---

## Step 3: Add your GitHub repo as "origin"

**Your repo:** `https://github.com/Shravan144/Bandits_LOC8A1.git`

```bash
git remote add origin https://github.com/Shravan144/Bandits_LOC8A1.git
```

If it says **"remote origin already exists"**, use this instead:

```bash
git remote set-url origin https://github.com/Shravan144/Bandits_LOC8A1.git
```

---

## Step 4: Add all files

```bash
git add .
```

This adds everything except what’s in `.gitignore` (e.g. `.venv`, `__pycache__`).

---

## Step 5: Commit

```bash
git commit -m "ForeTrade: Swipe to Export - hackathon submission"
```

---

## Step 6: Push to GitHub

**If your main branch is called `main`:**

```bash
git branch -M main
git push -u origin main
```

**If your repo already uses `master`:**

```bash
git push -u origin master
```

You may be asked for your **GitHub username** and **password**.  
Use a **Personal Access Token** as the password (GitHub no longer accepts account password for push).  
To create one: GitHub → Settings → Developer settings → Personal access tokens → Generate new token.

---

## Quick copy-paste (after you set the remote)

```bash
git add .
git commit -m "ForeTrade: Swipe to Export - hackathon submission"
git branch -M main
git push -u origin main
```

---

## Summary

| Step | What to do |
|------|------------|
| 1 | Open terminal in `foretrade` folder |
| 2 | `git init` (if needed) |
| 3 | `git remote add origin https://github.com/Shravan144/Bandits_LOC8A1.git` |
| 4 | `git add .` |
| 5 | `git commit -m "ForeTrade: Swipe to Export - hackathon submission"` |
| 6 | `git branch -M main` then `git push -u origin main` |

After this, your code will be on GitHub. You can repeat **Step 4 → 5 → 6** anytime to push updates.
