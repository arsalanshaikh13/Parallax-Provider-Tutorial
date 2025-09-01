# Technical Blog vs Technical Documentation: Complete Outline

## Technical Blog Outline

### 1. Structure & Organization

- **Hook/Introduction**: Compelling opening with personal anecdote or industry
  problem
- **Problem Statement**: Context and background explaining why this matters
- **Solution Journey**: Step-by-step exploration with thought process
- **Implementation Details**: Code examples with explanations and alternatives
- **Results & Analysis**: What worked, what didn't, performance metrics
- **Lessons Learned**: Key takeaways and recommendations
- **Conclusion**: Summary and future considerations
- **Call-to-Action**: Engage readers (comments, shares, follow-up content)

### 2. Content Characteristics

- **Tone**: Conversational, personal, engaging
- **Length**: 1000-3000 words typically
- **Perspective**: First-person experiences and opinions welcome
- **Examples**: Real-world scenarios with context and storytelling
- **Timing**: Reflects current trends, recent experiences, or emerging
  technologies

### 3. Audience Engagement

- **SEO Optimization**: Keywords, meta descriptions, social sharing
- **Community Building**: Comments, discussions, social media promotion
- **Thought Leadership**: Establishing expertise and industry presence

---

## Technical Documentation Outline

### 1. Structure & Organization

- **Title**: Clear, descriptive, action-oriented
- **Overview**: Brief purpose and scope
- **Prerequisites**: Required knowledge, tools, or setup
- **Step-by-Step Instructions**: Numbered, sequential procedures
- **Code Examples**: Copy-paste ready snippets with expected outputs
- **Configuration Details**: Settings, parameters, and options
- **Troubleshooting**: Common issues and solutions
- **References**: Related documentation and external resources

### 2. Content Characteristics

- **Tone**: Neutral, imperative, precise
- **Length**: Varies based on task complexity (200-2000+ words)
- **Perspective**: Third-person, objective, instruction-focused
- **Examples**: Practical, immediately applicable code and configurations
- **Timing**: Evergreen content that remains relevant over time

### 3. User Experience

- **Accessibility**: Easy navigation, search functionality, clear hierarchy
- **Maintenance**: Regular updates for accuracy and currency
- **Usability**: Scannable format with headers, bullets, and visual aids

---

## Key Differences

| Aspect                | Technical Blog                         | Technical Documentation            |
| --------------------- | -------------------------------------- | ---------------------------------- |
| **Primary Goal**      | Educate and inspire                    | Enable task completion             |
| **Writing Style**     | Narrative and storytelling             | Instructional and direct           |
| **Reader Journey**    | Linear, exploratory reading            | Random access, task-oriented       |
| **Personal Voice**    | Encouraged (opinions, experiences)     | Discouraged (neutral, objective)   |
| **Content Lifecycle** | Time-sensitive, trend-driven           | Evergreen, maintained long-term    |
| **Success Metrics**   | Engagement, shares, thought leadership | Task completion, user satisfaction |
| **Update Frequency**  | Occasional, based on new insights      | Regular, based on product changes  |

---

## Key Similarities

### 1. **Technical Accuracy**

- Both require precise, correct information
- Code examples must be tested and functional
- Technical details need verification and validation

### 2. **Clear Communication**

- Well-structured content with logical flow
- Appropriate use of technical terminology
- Visual aids (diagrams, screenshots, code blocks)

### 3. **Audience Awareness**

- Understanding target user's skill level and needs
- Appropriate depth and complexity for intended readers
- Context-appropriate examples and use cases

### 4. **Quality Standards**

- Proper grammar, spelling, and formatting
- Consistent style and terminology
- Regular review and updates for accuracy

### 5. **Supporting Elements**

- Code syntax highlighting and proper formatting
- Links to relevant resources and references
- Examples that illustrate key concepts

### 6. **User Value**

- Solve real problems or answer genuine questions
- Provide actionable information users can apply
- Respect the reader's time with efficient content organization

---

## When to Choose Which Format

**Choose Technical Blog When:**

- Sharing lessons learned from a project
- Comparing different approaches or technologies
- Building community engagement and discussion
- Establishing thought leadership
- Explaining the "why" behind technical decisions

**Choose Technical Documentation When:**

- Users need to complete specific tasks
- Providing reference material for ongoing use
- Documenting APIs, configurations, or procedures
- Supporting product features or services
- Creating maintainable, searchable knowledge base

Both formats serve essential but complementary roles in technical communication,
with blogs focusing on knowledge sharing and inspiration while documentation
enables practical application and task completion.

# When GitLab CI/CD Rules Don't Work: A Real-World Fix

## The Day I Spent Chasing GitLab's `rules:changes` Mystery

I had a simple goal: run GitLab CI only when specific files changed. Nothing
fancy—just basic optimization to avoid wasting pipeline minutes on documentation
updates or config tweaks.

The setup seemed straightforward enough:

```yaml
# What I thought would work
test:
  rules:
    - changes:
        - 'src/**/*.js'
        - 'package.json'
  script:
    - npm test
```

But here's the catch: I was triggering GitLab pipelines from GitHub Actions.
Every time GitHub detected a push, it would call GitLab's trigger API to start
the pipeline. Seemed like a reasonable cross-platform setup.

The problem? GitLab was running the full pipeline every single time, completely
ignoring my `rules:changes`. Whether I changed a single JavaScript file or just
updated the README, the entire test suite would run.

My first thought was typical developer debugging: "I must be doing something
wrong." I spent hours tweaking the YAML syntax, trying different file path
patterns, and reading GitLab's documentation.

Nothing worked.

That's when I turned to AI tools for help. ChatGPT gave me the usual
troubleshooting suggestions—check your file paths, validate your YAML syntax,
make sure the files actually exist. Standard advice that didn't address my
specific issue.

Claude was more helpful, mentioning something about `CI_COMMIT_BEFORE_SHA` and
how GitLab's change detection works internally. But the responses were
fragmented—pieces of a puzzle that didn't quite fit together.

The AI tools kept pointing me to GitLab docs about `rules:changes`, but none of
them explained why it would fail when triggered via API. I was getting different
answers from different tools, none of them complete.

That's when I realized I needed to look deeper. If GitLab was receiving the
trigger request from GitHub Actions, maybe the problem was in the payload being
sent.

I dove into the GitHub Actions logs and found the JSON payload it was sending to
GitLab's trigger API. There it was, staring me in the face:

```json
{
  "ref": "main",
  "variables": {...},
  "before": "0000000000000000000000000000000000000000"
}
```

All zeros. The `before` commit SHA was all zeros.

That's when it clicked—GitLab was receiving a trigger with no previous commit
reference, so it couldn't determine what files had actually changed. Without a
proper `before_sha`, `rules:changes` was useless.

## What I Discovered: The API Trigger Problem

With the GitHub Actions logs showing that all-zeros `before` SHA, everything
started making sense. I went back to the AI tools with this specific insight:
"Why does GitLab set CI_COMMIT_BEFORE_SHA to zeros when triggered via API?"

This time, the responses were much more targeted. Claude explained that GitLab's
`rules:changes` feature relies on comparing two commit SHAs to determine what
files changed. When a pipeline is triggered manually via API or trigger token
(which is what GitHub Actions was doing), GitLab doesn't have a "previous"
commit to compare against, so it defaults to all zeros.

ChatGPT filled in more details about how `git diff` works internally—you need
two valid commit references to determine changes. With one of them being all
zeros, the diff operation essentially breaks, and GitLab falls back to running
all jobs regardless of your `rules:changes` configuration.

The pieces finally came together:

1. **GitHub Actions triggers GitLab via API** → `before_sha` gets set to zeros
2. **GitLab tries to run `git diff` between current commit and all-zeros** →
   diff fails
3. **`rules:changes` can't determine what files changed** → runs all jobs as
   fallback
4. **My carefully crafted conditional logic becomes useless** → full pipeline
   every time

This explained why the same GitLab configuration worked fine when triggered by
direct pushes to GitLab (where `before_sha` is properly set) but failed when
triggered externally through GitHub Actions.

The frustrating part? None of the GitLab documentation mentions this limitation
clearly. The AI tools helped me connect the dots, but I had to dig into the
actual API payload logs to find the smoking gun.

This explains everything:

- **API-triggered deployments**: All zeros → unreliable change detection
- **Manual pipeline runs**: All zeros → rules ignore actual changes
- **External CI triggers**: All zeros → complete conditional failure
- **Scheduled pipelines**: Often all zeros → unpredictable behavior

But here's the kicker: this only happens sometimes. Push-based pipelines usually
work fine, which is why this issue flew under our radar for months. It only
surfaced when we started using more sophisticated triggering mechanisms.

## The Real Learning: When Logs Tell the Truth

This experience taught me something important about debugging modern DevOps
setups: sometimes the answer isn't in the documentation or even AI
responses—it's in the actual data being passed between systems.

The GitHub Actions logs were the key. Without seeing that JSON payload with the
all-zeros `before` SHA, I would have spent even longer trying to fix my GitLab
YAML configuration, when the real issue was how the two platforms were
communicating.

Here's what I learned about the debugging process:

**AI tools are great starting points**: They gave me the vocabulary and concepts
I needed, but they couldn't diagnose my specific cross-platform setup issue.

**Logs don't lie**: The JSON payload showed exactly what GitLab was receiving,
which was different from what I expected GitHub Actions to send.

**Platform integration edge cases are rarely documented**: GitLab's docs focus
on GitLab-native workflows. GitHub Actions docs focus on GitHub-native
integrations. The intersection? You're on your own.

**The "simple" solution isn't always simple**: What seemed like a basic
optimization (run CI only for relevant files) revealed a fundamental limitation
in how these platforms work together.

The irony? My original goal was just to save some CI minutes by skipping
unnecessary runs. Instead, I uncovered a design limitation that affects anyone
trying to use GitLab CI with external trigger systems—which is probably more
common than GitLab realizes.

## Why This Matters Beyond Our Team

Before I dive into our solution, let me be clear about why this matters for any
team using GitLab CI/CD:

**Resource Waste**: Teams are running unnecessary builds, burning through CI
minutes, and slowing down development cycles without realizing it.

**Silent Failures**: Unlike most CI/CD issues that fail loudly, this one fails
silently. Your pipeline appears to work, but it's making wrong decisions about
when to run jobs.

**Scale Problems**: As your codebase grows and you add more conditional logic,
this issue compounds. What works for a small project becomes unreliable at
enterprise scale.

**Developer Trust**: When CI/CD behaves unpredictably, teams lose confidence in
automation and revert to manual processes—exactly the opposite of what DevOps
should achieve.

## The Path Forward

Rather than fight GitLab's limitations or wait for them to fix this issue, we
decided to build around them. Our solution needed to be:

- **100% reliable** across all trigger scenarios
- **Performance-optimized** to handle large codebases efficiently
- **Maintainable** for a growing team and expanding project portfolio
- **Battle-tested** with real production workloads

What we built exceeded those goals and transformed how our entire organization
thinks about CI/CD architecture.

In the next part, I'll walk you through our complete solution: a modular,
dynamic pipeline system that's been running flawlessly across 15+ projects for
the past six months.

_Have you experienced similar issues with GitLab CI/CD reliability? I'd love to
hear about your experiences in the comments below._

---

## My Learning Approach

When GitLab's built-in features failed in production scenarios, I took a
systematic approach:

1. **Root Cause Analysis**: Identified why GitLab's native features break in
   specific scenarios
2. **Defensive Programming**: Built solutions that handle GitLab's inconsistent
   behavior
3. **Performance Testing**: Measured improvements across different pipeline
   configurations
4. **Modular Design**: Created reusable components that scale across projects

#### My Advanced Learning Workflow

- **Research**: Used official docs for verified information, youtube videos
  tutorials, and AI-modesl like ChatGPT, Claude and Gemini to quickly gather
  possible approaches, compare trade-offs, and understand edge cases.
- **Implementation**: Adapted AI-suggested boilerplate code to fit project
  requirements.
- **Troubleshooting**: Iteratively tested and debugged, validating each step
  myself.
- **Reflection**: Documented what worked, what didn’t, and the reasoning behind
  final design choices.

-_“Throughout this project, I used docs, youtube tutorials, and AI models to
clarify concepts, troubleshoot errors, and compare alternative solutions. This
approach allowed me to deepen my understanding by experimenting with multiple
strategies in less time than traditional trial-and-error.”_

- _“I leveraged ChatGPT as a research assistant to quickly explore different
  solution paths, debug issues, and generate boilerplate code. Every
  AI-generated suggestion was tested, adapted, and validated manually.”_
- _“Like pair programming with an AI — it accelerates discovery, but the
  responsibility to reason, refine, and integrate rests with me.”_

## 🧪 Research

- Studied GitLab’s documentation on modular CI/CD and dynamic pipelines.
- Analyzed limitations of `rules:changes` across different pipeline trigger
  types.
- Explored best practices from community blogs, forums, and reference
  repositories.
- Identified pain points of monolithic pipelines in scalability, debugging, and
  performance.

---

## 🔧 Implementation

- Modularized the pipeline using `include:` and reusable YAML templates.
- Introduced parent/child architecture with `trigger` and `strategy: depend`.
- Built a runtime detection script using `git diff` to track relevant file
  changes.
- Configured `workflow.rules` to restrict when pipelines run.

---

## 🐞 Troubleshooting

- Faced unreliable triggering with `rules:changes` — resolved using `git diff`.
- Resolved artifact pulling in unrelated jobs using `artifacts: false`.
- Optimized redundant cache saving using `policy: pull`.
- Handled skipped pipelines by implementing a fallback to empty child pipelines.

---

## 💡 Reflection

- Dynamic pipelines improve performance, maintainability, and debugging.
- Centralizing logic simplifies scaling and reduces human error.
- Runtime detection enables consistent behavior across all triggers.
- Modular design fosters reuse, collaboration, and clearer workflows.
