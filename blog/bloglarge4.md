Perfect! Let’s move on to **Part 4: Triggering Workflows Across Repos via
API**—the grand finale of your portfolio blog. This is where your pipeline shows
off **orchestration power**, and it’s something hiring managers and senior
developers love seeing in a candidate’s work.

---

# 🚀 Part 4: Triggering Workflows Across Repositories via API

### TL;DR

- You can **trigger workflows in the same or different repos** using GitHub’s
  REST API or `workflow_dispatch`.
- Enables **multi-repo CI/CD orchestration**, making your pipelines modular,
  reusable, and enterprise-ready.
- Perfect for **portfolio demos**, showing end-to-end control over complex
  workflows.

---

## 🔗 Why Trigger Workflows Remotely?

Imagine these scenarios:

1. You have **shared libraries** or **microservices** in separate repos.
2. One repo’s changes need to **kick off builds/tests** in dependent repos.
3. You want to **orchestrate multiple repos** from a single “parent” workflow.

Without API-triggered workflows, you’d manually trigger jobs or rely on pull
requests—a slow, error-prone process.

With **`workflow_dispatch` + API calls**, your CI/CD becomes **centralized,
automated, and auditable**.

---

## 🛠 How to Trigger a Workflow in the Same Repo

```yaml
- name: Trigger downstream workflow
  uses: peter-evans/workflow-dispatch@v2
  with:
    workflow: 'ci.yml' # target workflow file
    ref: 'main' # branch/tag to trigger
    inputs: # optional
      env: 'staging'
      runTests: true
```

- `workflow` → filename of the workflow to trigger.
- `ref` → branch or tag.
- `inputs` → pass parameters like environment, flags, or secrets.

✅ Your parent workflow now orchestrates **child workflows** in the same repo.

---

## 🌍 Triggering a Workflow in a Different Repo

```yaml
- name: Trigger workflow in another repo
  uses: benc-uk/workflow-dispatch@v1
  with:
    token: ${{ secrets.PERSONAL_ACCESS_TOKEN }}
    repository: 'username/other-repo'
    workflow: 'ci.yml'
    ref: 'main'
    inputs: |
      env: 'production'
      runTests: true
```

- Requires a **Personal Access Token** (PAT) with `repo` scope.
- Allows full **cross-repo CI/CD orchestration**.
- Input parameters let you **customize the triggered workflow dynamically**.

---

## 🔄 Combining with Modular Architecture

Here’s how it fits in your portfolio-ready pipeline:

1. **Parent workflow** detects changes or receives a trigger.
2. **Reusable workflows** handle build/test/publish in modular units.
3. **Composite actions** perform repeatable tasks (checkout, cache, coverage).
4. **Artifacts and cache** ensure consistent data transfer.
5. **Parent triggers child workflows** in same or other repos, passing inputs
   and secrets.

This design is **enterprise-grade**, demonstrating **full pipeline
orchestration**, modularity, and automation.

---

## 💡 Real-World Use Cases

| Scenario                         | Solution via API-triggered workflows                                   |
| -------------------------------- | ---------------------------------------------------------------------- |
| Monorepo with multiple services  | Parent triggers build/test in service-specific repos                   |
| Shared libraries                 | Update in core library triggers downstream tests in dependent projects |
| Environment-specific deployments | Workflow_dispatch with `env=staging/production` parameter              |
| Portfolio showcase               | Demonstrates full CI/CD lifecycle in a single blog demo                |

---

## ✅ Best Practices

- Use **PAT tokens** carefully—store in secrets, never hardcode.
- Validate inputs to avoid accidental deployments.
- Combine with **status checks** in parent workflow to gate merges.
- Document **workflow structure in your blog** with flowcharts for clarity.

---

## 🔄 Summary: Putting It All Together

With **Parts 1–4**, your portfolio blog demonstrates:

1. **Modular workflows** – reusable, maintainable, and testable.
2. **Artifacts & caching** – performance-optimized, deterministic pipelines.
3. **Jest coverage & summaries** – developer-friendly insights.
4. **API-triggered workflows** – multi-repo orchestration, enterprise-ready.

💡 A blog showcasing this demonstrates **advanced DevOps skills**, **end-to-end
CI/CD understanding**, and a **real-world problem-solving mindset**—exactly what
senior developers and hiring managers look for.

---

## ⚡ CTA for Readers

- Try **building your own modular GitHub Actions pipeline** using this guide.
- Share your **flowcharts, screenshots, and results** to make your blog visually
  engaging.
- Include **cross-repo workflow triggers** to show advanced orchestration.
- Highlight **performance metrics, coverage reports, and caching
  strategy**—these are portfolio gold.

---

If you want, I can now **draft a full blog post outline** that combines **all
four parts** into a **single deep-dive, portfolio-ready guide**, including
hooks, flowcharts, examples, TL;DR sections, and CTAs—perfect for junior-to-mid
developers and hiring managers alike.

Do you want me to do that next?
