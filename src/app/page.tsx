export default function HomePage() {
  return (
    <main className="landing-page">
      <section className="landing-grid">
        <div>
          <p className="eyebrow">FUNCTIONAL PHOTO AUGMENTATION</p>
          <h1>See the room you have. Explore what could work better.</h1>
          <p className="lead">NestMetric starts with a real photo of your room, then helps you organize, rearrange, or design for that space. Measurements and geometry stay underneath the experience when accuracy matters.</p>
          <div className="actions"><a className="button primary" href="/studio">Open your room</a><a className="button secondary" href="/login">Sign in</a></div>
        </div>
        <div className="hero-photo-stack" aria-label="Example room photo augmentation">
          <div className="hero-photo-card original">
            <span className="hero-photo-label">Original room</span>
            <div className="hero-room-scene">
              <span className="hero-window" />
              <span className="hero-sofa" />
              <span className="hero-table" />
              <span className="hero-clutter one" />
              <span className="hero-clutter two" />
            </div>
          </div>
          <div className="hero-photo-card augmented">
            <span className="hero-photo-label">Organize proposal</span>
            <div className="hero-room-scene improved">
              <span className="hero-window" />
              <span className="hero-sofa" />
              <span className="hero-table" />
              <span className="hero-storage" />
            </div>
          </div>
          <div className="hero-photo-meta"><span>Photo first</span><span>Geometry when needed</span></div>
        </div>
      </section>
      <section className="feature-row">
        <article><b>01</b><h2>Organize</h2><p>Use the room you actually see to reduce clutter, improve storage, and protect everyday circulation.</p></article>
        <article><b>02</b><h2>Arrange</h2><p>Explore believable visual alternatives before moving furniture or buying something new.</p></article>
        <article><b>03</b><h2>Build</h2><p>Visualize a shelf, cabinet, or other project in place, then bring verified measurements forward when the concept becomes real work.</p></article>
      </section>
    </main>
  );
}
