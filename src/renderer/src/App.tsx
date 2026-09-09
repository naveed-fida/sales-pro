// Deliberately unstyled: Tailwind is wired up in the next step, and adding
// stopgap CSS here would only have to be torn out again.
export function App(): React.JSX.Element {
  const versions = window.electron.process.versions

  return (
    <main>
      <h1>Sales Pro</h1>
      <p>Scaffold is running. Styling and features land in the next steps.</p>
      <dl>
        <dt>Electron</dt>
        <dd>{versions.electron}</dd>
        <dt>Chromium</dt>
        <dd>{versions.chrome}</dd>
        <dt>Node</dt>
        <dd>{versions.node}</dd>
      </dl>
    </main>
  )
}
