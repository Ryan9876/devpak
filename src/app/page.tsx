export default function HomePage() {
  return (
    <main className="landing-page">
      <section className="landing-grid">
        <div>
          <p className="eyebrow">ROOM INTELLIGENCE</p>
          <h1>Understand the room. Then change it with confidence.</h1>
          <p className="lead">NestMetric turns verified room dimensions, photos, objects and constraints into one editable Room Model for organizing, arranging and building.</p>
          <div className="actions"><a className="button primary" href="/projects">Open Projects</a><a className="button secondary" href="/studio">Open latest room</a></div>
        </div>
        <div className="hero-plan" aria-label="Example room plan">
          <div className="room-outline"><span className="obj sofa">Sofa</span><span className="obj table">Table</span><span className="obj shelf">Shelf</span><span className="door">Door</span></div>
          <div className="hero-meta"><span>12′ 8″ × 10′ 4″</span><span>Verified geometry</span></div>
        </div>
      </section>
      <section className="feature-row">
        <article><b>01</b><h2>Organize</h2><p>Reduce clutter, protect circulation and compare multiple space-optimization proposals.</p></article>
        <article><b>02</b><h2>Arrange</h2><p>Move, rotate and resize objects against the same physical room model.</p></article>
        <article><b>03</b><h2>Build</h2><p>Gate build-critical geometry on verified measurements before generating plans and materials.</p></article>
      </section>
    </main>
  );
}
