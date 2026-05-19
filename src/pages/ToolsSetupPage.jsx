const TOOLS = [
  {
    num: 1,
    icon: "🖥️",
    iconBg: "linear-gradient(135deg,#e0f2fe,#bae6fd)",
    title: "VS Code",
    steps: [
      "Download from code.visualstudio.com",
      "Install with default options + PATH support",
      "Open VS Code and verify startup"
    ],
    linkHref: "https://code.visualstudio.com/",
    linkLabel: "Download VS Code",
    img: "https://code.visualstudio.com/assets/home/swimlane-anywhere-light.png",
    imgAlt: "Visual Studio Code"
  },
  {
    num: 2,
    icon: "🐍",
    iconBg: "linear-gradient(135deg,#fef3c7,#fde68a)",
    title: "Python 3",
    steps: [
      "Install Python 3 from python.org",
      "Enable PATH checkbox during install on Windows",
      "Verify with: python --version"
    ],
    linkHref: "https://www.python.org/downloads/",
    linkLabel: "Download Python",
    img: "https://devguide.python.org/_static/release-cycle.svg",
    imgAlt: "Python downloads"
  },
  {
    num: 3,
    icon: "🤖",
    iconBg: "linear-gradient(135deg,#ccfbf1,#99f6e4)",
    title: "Copilot Chat",
    steps: [
      "Open Extensions view in VS Code (Ctrl+Shift+X)",
      "Search \"GitHub Copilot Chat\" and install",
      "Sign in with GitHub and verify chat panel opens"
    ],
    linkHref: "https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat",
    linkLabel: "Open Extension",
    img: "https://github.com/microsoft/vscode-docs/raw/refs/heads/main/docs/copilot/images/overview/agents-intro.gif",
    imgAlt: "GitHub Copilot Chat"
  }
];

export default function ToolsSetupPage() {
  return (
    <>
      <div className="page-header ph-slate animate-in" style={{ marginBottom: "1.75rem" }}>
        <div className="page-header-eyebrow">🛠️ Student Setup</div>
        <h1 style={{ fontSize: "2rem" }}>Workshop Tools Setup</h1>
        <p className="text-secondary mb-0">Install VS Code, Python, and GitHub Copilot Chat before your first session.</p>
      </div>

      <div className="row g-3">
        {TOOLS.map((tool, idx) => (
          <div className={`col-lg-4 animate-in animate-in-${idx + 2}`} key={tool.title}>
            <article className="section-card p-4 h-100 d-flex flex-column">
              <div className="feature-icon" style={{ background: tool.iconBg }}>
                {tool.icon}
              </div>
              <div className="d-flex align-items-center gap-2 mb-3">
                <span className="mono" style={{ fontSize: "0.68rem", color: "var(--ink-300)", fontWeight: 700 }}>0{tool.num}</span>
                <h2 className="h5 mb-0" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700 }}>{tool.title}</h2>
              </div>
              <ol style={{ paddingLeft: "1.2rem", color: "var(--ink-700)", fontSize: "0.9rem", marginBottom: "1rem" }}>
                {tool.steps.map((step) => (
                  <li key={step} style={{ marginBottom: "0.35rem" }}>{step}</li>
                ))}
              </ol>
              <a
                href={tool.linkHref}
                target="_blank"
                rel="noreferrer"
                className="btn btn-dark btn-sm mb-3"
                style={{ alignSelf: "flex-start" }}
              >
                {tool.linkLabel} ↗
              </a>
              <img
                className="tools-image mt-auto"
                src={tool.img}
                alt={tool.imgAlt}
                loading="lazy"
              />
            </article>
          </div>
        ))}
      </div>
    </>
  );
}
