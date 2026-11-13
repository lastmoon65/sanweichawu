export function App() {
  return (
    <main className="app-shell">
      <header className="brand-block">
        <span className="eyebrow">SANWEI TEA HOUSE</span>
        <h1>三味茶屋</h1>
        <p>商家端工程骨架</p>
      </header>

      <section className="status-card" aria-labelledby="status-title">
        <span className="status-dot" aria-hidden="true" />
        <div>
          <h2 id="status-title">工程基础已就绪</h2>
          <p>当前仅包含 P1-01 工具链、测试和构建能力，未接入业务、认证或数据层。</p>
        </div>
      </section>
    </main>
  );
}
