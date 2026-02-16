# GitHub Setup — Quick Guide

Your repo is initialized with an initial commit. Follow these steps to push to GitHub.

---

## 1. Create the repo on GitHub

1. Go to [github.com/new](https://github.com/new)
2. **Repository name:** `workhero` (or whatever you prefer)
3. **Description:** `CQRS backend with durable LMDB job queue — workers fetch bird summaries from Wikipedia`
4. Choose **Public**
5. **Do NOT** initialize with README, .gitignore, or license (you already have these)
6. Click **Create repository**

---

## 2. Add the remote and push

GitHub will show you commands. Use these (replace `YOUR_USERNAME` with your GitHub username):

```bash
cd /Users/keilaloia/Documents/interview/workhero

# Add the remote (use the URL from your new repo)
git remote add origin https://github.com/YOUR_USERNAME/workhero.git

# Push to GitHub
git push -u origin main
```

**If you use SSH instead:**
```bash
git remote add origin git@github.com:YOUR_USERNAME/workhero.git
git push -u origin main
```

---

## 3. Verify

- Open `https://github.com/YOUR_USERNAME/workhero` in your browser
- Confirm all files are there
- Check that README renders correctly

---

## Troubleshooting

**"Permission denied" or "Authentication failed"**
- Use a [Personal Access Token](https://github.com/settings/tokens) instead of password for HTTPS
- Or set up [SSH keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)

**"Branch 'main' doesn't exist"**
- You're on `main` already. If GitHub created `master`, you can push with: `git push -u origin main`
