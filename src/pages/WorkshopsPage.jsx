import { WORKSHOPS } from "../data/workshopsData";

export default function WorkshopsPage() {
  return (
    <section className="section-card rounded-3 p-4">
      <h1 className="h3 mb-3">Pod 1A-US Workshop Sessions</h1>
      <p className="text-secondary">Six-session cycle from kickoff to retrospective improvement.</p>
      <div className="row g-3 mt-1">
        {WORKSHOPS.map((workshop, idx) => (
          <div className="col-md-6" key={workshop.title}>
            <article className="border rounded p-3 bg-white h-100">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h2 className="h5 mb-0">{workshop.title}</h2>
                <span className="badge text-bg-secondary">{new Date(workshop.date).toLocaleDateString()}</span>
              </div>
              <p className="fw-semibold">Focus: {workshop.focus}</p>
              <ul className="mb-0">
                {workshop.outcomes.map((item) => (
                  <li key={`${workshop.title}-${item}`}>{item}</li>
                ))}
              </ul>
              <div className="mono small text-secondary mt-2">Session {idx + 1} of {WORKSHOPS.length}</div>
            </article>
          </div>
        ))}
      </div>
    </section>
  );
}
