import { getMembersByTeam } from "../data/membersData";

export default function RosterPage() {
  const grouped = getMembersByTeam();

  return (
    <section className="section-card rounded-3 p-4">
      <h1 className="h3 mb-3">Team Roster</h1>
      <p className="text-secondary">All members grouped by their coaching team.</p>
      <div className="row g-3 mt-1">
        {Object.entries(grouped).map(([team, members]) => (
          <div className="col-md-6" key={team}>
            <article className="border rounded p-3 bg-white h-100">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h2 className="h5 mb-0">{team}</h2>
                <span className="badge text-bg-dark">{members.length}</span>
              </div>
              <ul className="mb-0">
                {members
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((member) => (
                    <li key={member.slug}>{member.name}</li>
                  ))}
              </ul>
            </article>
          </div>
        ))}
      </div>
    </section>
  );
}
