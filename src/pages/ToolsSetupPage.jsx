export default function ToolsSetupPage() {
  return (
    <>
      <section className="hero-card rounded-3 p-4 mb-3">
        <h1 className="h3 mb-2">Workshop Tools Setup</h1>
        <p className="text-secondary mb-0">
          Install Visual Studio Code, Python, and GitHub Copilot Chat before class.
        </p>
      </section>

      <section className="section-card rounded-3 p-4 mb-3">
        <h2 className="h5">What to install</h2>
        <ul>
          <li>
            <a href="https://code.visualstudio.com/" target="_blank" rel="noreferrer">
              Visual Studio Code
            </a>
          </li>
          <li>
            <a href="https://www.python.org/downloads/" target="_blank" rel="noreferrer">
              Python
            </a>
          </li>
          <li>
            <a
              href="https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat"
              target="_blank"
              rel="noreferrer"
            >
              GitHub Copilot Chat
            </a>
          </li>
        </ul>
      </section>

      <div className="row g-3">
        <div className="col-lg-4">
          <section className="section-card rounded-3 p-3 h-100">
            <h3 className="h6">1. VS Code</h3>
            <ol>
              <li>Download from the official VS Code site.</li>
              <li>Install with default options and PATH support.</li>
              <li>Open VS Code and verify startup.</li>
            </ol>
            <img
              className="tools-image"
              src="https://code.visualstudio.com/assets/home/swimlane-anywhere-light.png"
              alt="Visual Studio Code"
              loading="lazy"
            />
          </section>
        </div>

        <div className="col-lg-4">
          <section className="section-card rounded-3 p-3 h-100">
            <h3 className="h6">2. Python</h3>
            <ol>
              <li>Install Python 3 from python.org.</li>
              <li>Enable PATH during install on Windows.</li>
              <li>Verify with python --version or python3 --version.</li>
            </ol>
            <img
              className="tools-image"
              src="https://devguide.python.org/_static/release-cycle.svg"
              alt="Python downloads"
              loading="lazy"
            />
          </section>
        </div>

        <div className="col-lg-4">
          <section className="section-card rounded-3 p-3 h-100">
            <h3 className="h6">3. Copilot Chat</h3>
            <ol>
              <li>Open VS Code Extensions view.</li>
              <li>Install GitHub Copilot Chat extension.</li>
              <li>Sign in and verify the chat panel opens.</li>
            </ol>
            <img
              className="tools-image"
              src="https://github.com/microsoft/vscode-docs/raw/refs/heads/main/docs/copilot/images/overview/agents-intro.gif"
              alt="GitHub Copilot Chat"
              loading="lazy"
            />
          </section>
        </div>
      </div>
    </>
  );
}
