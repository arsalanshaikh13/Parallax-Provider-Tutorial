Perfect 🙌 Let’s continue with **Part 2: Cache + Artifacts** in the same
portfolio-blog style. This section will not only explain but also show why these
are the “unsung heroes” of speeding up and stabilizing CI/CD.

---

# ⚡ Making CI/CD Faster & Smarter with Cache and Artifacts (Part 2)

### TL;DR

- **Cache** saves dependencies so you don’t reinstall them from scratch every
  run.
- **Artifacts** let you pass files between jobs (e.g., build → test → deploy).
  Together, they make your workflows faster, cheaper, and easier to debug.

---

## 🚀 Why Caching and Artifacts Matter

Imagine cooking pasta every night.

- Without a fridge, you’d have to **buy new ingredients every time** (slow,
  wasteful).
- With a fridge, you can **reuse what you already have** (faster, cheaper).

That’s caching in CI/CD.

Now imagine cooking in teams:

- The chef boils the pasta, but the next chef making the sauce has to start over
  because the pasta wasn’t saved.
- If you could **hand over the boiled pasta**, each step builds on the last.

That’s artifacts.

---

## 📦 Caching Dependencies

Every Node.js developer has seen this:

```yaml
- run: npm ci
```

On every workflow run, it reinstalls packages—painfully slow.

### With caching:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: 'npm'
```

That’s it. The `cache: 'npm'` flag ensures dependencies are only reinstalled
when `package-lock.json` changes.

**Impact**:

- Cut workflow time by 30–60%.
- Save GitHub Action minutes (and your sanity).

🔍 Pro tip: Put caching logic inside a **composite action**, so all workflows
benefit without repeating config.

---

## 📤 Uploading & Downloading Artifacts

Artifacts are like “USB drives” between jobs.

Example: build → test → deploy.

### Build job (upload artifact):

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: dist-files
          path: dist/
```

### Test job (download artifact):

```yaml
test:
  needs: build
  runs-on: ubuntu-latest
  steps:
    - uses: actions/download-artifact@v4
      with:
        name: dist-files
    - run: npm test
```

### Deploy job (reuse artifact):

```yaml
deploy:
  needs: [build, test]
  runs-on: ubuntu-latest
  steps:
    - uses: actions/download-artifact@v4
      with:
        name: dist-files
    - run: npm run deploy
```

🔑 Benefits:

- **Consistency**: All jobs use the same build output.
- **Debugging**: You can download artifacts locally if something fails.
- **Flexibility**: Split jobs logically but still share results.

---

## ⚖️ Cache vs Artifacts

| Feature     | Cache                         | Artifacts                   |
| ----------- | ----------------------------- | --------------------------- |
| Purpose     | Reuse dependencies/data       | Pass files between jobs     |
| Persistence | Automatic invalidation        | Explicit per run            |
| Example     | `node_modules`, Docker layers | Build output, reports, logs |

👉 Rule of thumb:

- Use **cache** for “libraries you install”.
- Use **artifacts** for “files you generate”.

---

## ✅ Recap

In this part, we covered:

- How caching saves time and money.
- How artifacts let jobs “talk” to each other.
- Real-world patterns (build → test → deploy).

---

## 📌 Coming Next: Making CI Human-Friendly

In Part 3, we’ll explore:

- Generating **Jest coverage reports** on PRs.
- Writing **Job Summaries** that turn YAML logs into human-readable results.

Because a pipeline isn’t just for machines—it’s also for the humans reviewing
PRs.

---

⚡ **CTA:**

- Try adding cache + artifact steps to your existing CI
- Share with a teammate stuck on slow builds
- Follow along for Part 3 (coverage reports + summaries)

---

👉 Want me to continue with **Part 3 (Jest coverage reports + job summaries)**
so you’ll have a 3-part portfolio-ready blog series lined up?
