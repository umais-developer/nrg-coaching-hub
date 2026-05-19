export const TEAM_MEMBERS = [
  { name: "Curt Houghton", slug: "curt-houghton", team: "Team Brad" },
  { name: "Laura Johnson", slug: "laura-johnson", team: "Team Brad" },
  { name: "Eric Ross", slug: "eric-ross", team: "Team Brad" },
  { name: "Bowen Revill", slug: "bowen-revill", team: "Team Brad" },
  { name: "Efren Romo", slug: "efren-romo", team: "Team Brad" },
  { name: "Kelly Nielsen", slug: "kelly-nielsen", team: "Team Brad" },
  { name: "Bredyn McCoombs", slug: "bredyn-mccoombs", team: "Team Brad" },
  { name: "Bret Hutchison", slug: "bret-hutchison", team: "Team Brad" },
  { name: "Sam Gonzalez", slug: "sam-gonzalez", team: "Team Brad" },
  { name: "Aaron Medina", slug: "aaron-medina", team: "Team Brad" },
  { name: "Ethan Goodman", slug: "ethan-goodman", team: "Team Brad" },
  { name: "Mishelle Fairbourn", slug: "mishelle-fairbourn", team: "Team Brad" },
  { name: "Reed Remington", slug: "reed-remington", team: "Team Brad" },
  { name: "Yuliya Kauwe", slug: "yuliya-kauwe", team: "Partner Team" },
  { name: "Joshua Moon", slug: "joshua-moon", team: "Partner Team" },
  { name: "Nathan Haug", slug: "nathan-haug", team: "Partner Team" },
  { name: "Lyndsie Scheib", slug: "lyndsie-scheib", team: "Partner Team" },
  { name: "Yurii Paklikovskyi", slug: "yurii-paklikovskyi", team: "Partner Team" },
  { name: "Nate Wixom", slug: "nate-wixom", team: "Partner Team" },
  { name: "Iurie Gavriliuc", slug: "iurie-gavriliuc", team: "Partner Team" },
  { name: "Vladyslav Buriak", slug: "vladyslav-buriak", team: "Indirect Team" },
  { name: "Oleksii Polishchuk", slug: "oleksii-polishchuk", team: "Indirect Team" },
  { name: "Oksana Karvatska", slug: "oksana-karvatska", team: "Indirect Team" },
  { name: "Olha Shumeiko", slug: "olha-shumeiko", team: "Indirect Team" },
  { name: "Daryna Lysenko", slug: "daryna-lysenko", team: "Amigo Team" },
  { name: "Serhii Shevchenko", slug: "serhii-shevchenko", team: "Amigo Team" },
  { name: "Bohdan Bybliv", slug: "bohdan-bybliv", team: "Amigo Team" },
  { name: "Nazar Melnyk", slug: "nazar-melnyk", team: "Amigo Team" },
  { name: "Santiago Herrera Gatica", slug: "santiago-herrera-gatica", team: "Amigo Team" },
  { name: "Polina Martynova", slug: "polina-martynova", team: "Amigo Team" },
  { name: "Yana Suprun", slug: "yana-suprun", team: "Amigo Team" },
  { name: "Helena Horta Dazarola", slug: "helena-horta-dazarola", team: "Amigo Team" },
  { name: "Artem Lutsko", slug: "artem-lutsko", team: "Amigo Team" },
  { name: "Olha Zavodna", slug: "olha-zavodna", team: "Amigo Team" },
  { name: "Andrii Hasiuk", slug: "andrii-hasiuk", team: "Amigo Team" },
  { name: "Inna Matviichuk", slug: "inna-matviichuk", team: "Amigo Team" },
  { name: "Lelyzaveta Shabetnyk", slug: "lelyzaveta-shabetnyk", team: "Amigo Team" }
];

export function getMemberBySlug(slug) {
  return TEAM_MEMBERS.find((member) => member.slug === slug);
}

export function getMembersByTeam() {
  return TEAM_MEMBERS.reduce((acc, member) => {
    if (!acc[member.team]) {
      acc[member.team] = [];
    }
    acc[member.team].push(member);
    return acc;
  }, {});
}
