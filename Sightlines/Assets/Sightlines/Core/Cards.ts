/**
 * Sourced building cards: the ONLY facts the guide may speak. Checked Nov 14 2026 by opening each source page
 * (Stanford-run pages unless noted). The AI chooses and frames these facts; it never adds new ones.
 *
 * Kept out until verified from an opened primary page: Gates "room 360", Ram Shriram's Google investment,
 * the Allen building's Microsoft link, NVIDIA's founding story, Hoover deck hours (they change).
 */

export type Theme = "namesake" | "founder" | "inside" | "architecture" | "fun"

export interface Fact {
  id: string
  theme: Theme
  text: string
  source: string
}

export interface Card {
  id: string
  /** Name to speak and label. */
  name: string
  /** Short label for the map. */
  label: string
  /** Who/what the name honours, for the founders constellation. Empty if not a person. */
  namesake: string
  tags: string[]
  facts: Fact[]
  /** Off-map places (beyond the map edge) get an edge pointer instead of a building. */
  offMap?: {lat: number; lon: number}
}

const ENG = "https://engineering.stanford.edu/news/huang-center-dedicated-lauded-stanfords-engineering-anchor"
const E100_DESIGN = "https://engineering100.stanford.edu/stories/designing-for-the-future"
const E100_FUTURE = "https://engineering100.stanford.edu/stories/the-future-firmly-in-sight"
const E100_SPACES = "https://engineering100.stanford.edu/stories/new-spaces-and-expanding-influence"
const E100_REDEV = "https://engineering100.stanford.edu/stories/redevelopment-and-an-earthquake"
const CS_GATES = "https://www.cs.stanford.edu/about/gates-computer-science-building"
const ETHW = "https://ethw.org/Milestones:PageRank_and_the_Birth_of_Google,_1996-1998"
const Y2E2_PLAT = "https://engineering.stanford.edu/news/stanfords-environment-and-energy-building-achieves-platinum-grade"
const Y2E2_MAG = "https://stanfordmag.org/contents/a-building-that-breathes"
const SHRIRAM = "https://engineering.stanford.edu/news/bioengineering-and-chemical-engineering-building-named-gifts-shrirams"
const SPILKER_DED = "https://engineering.stanford.edu/news/stanford-dedicates-spilker-engineering-and-applied-sciences-building"
const SPILKER_OBIT = "https://engineering.stanford.edu/news/james-spilker-jr-father-gps-has-died-86"
const NANO = "https://nanoguide.stanford.edu/guide/about/history"
const HOOVER_AP = "https://architectplanning.stanford.edu/hoover-tower"
const HOOVER_LOU = "https://www.hoover.org/news/hoover-tower-observatory-and-carillon-named-memory-lou-henry-hoover"
const HOOVER_BELLS = "https://www.hoover.org/events/history-hoover-carillon"
const MEMCHU = "https://orsl.stanford.edu/memorial-church-history"
const QUAD = "https://pcad.lib.washington.edu/building/1683/"
const CANTOR = "https://museum.stanford.edu/about/history"
const HP_GARAGE = "https://ohp.parks.ca.gov/ListedResources/Detail/976"

export const CARDS: Card[] = [
  {
    id: "huang", name: "Huang Engineering Center", label: "Huang", namesake: "Jensen Huang, NVIDIA co-founder",
    tags: ["tech founder", "engineering", "you are here"],
    facts: [
      {id: "huang.1", theme: "namesake", text: "It's named for NVIDIA co-founder Jensen Huang, who earned a Stanford master's in electrical engineering in 1992, and his wife Lori, whose 30 million dollar gift built it.", source: ENG},
      {id: "huang.2", theme: "inside", text: "Inside are the engineering dean's office, Management Science and Engineering, the Terman Engineering Library, and the 300-seat NVIDIA Auditorium.", source: ENG},
      {id: "huang.3", theme: "founder", text: "The lobby displays the toy-block-encased servers Larry Page and Sergey Brin used to test PageRank, and original Yahoo servers too.", source: E100_DESIGN},
      {id: "huang.4", theme: "architecture", text: "It anchors the engineering quad, lined up east to west with the historic Main Quad, and uses about half the energy of a comparable building.", source: ENG}
    ]
  },
  {
    id: "gates", name: "Gates Computer Science Building", label: "Gates", namesake: "Bill Gates, Microsoft co-founder",
    tags: ["tech founder", "computer science", "google"],
    facts: [
      {id: "gates.1", theme: "namesake", text: "It's named for Microsoft co-founder Bill Gates, who gave 6 million dollars toward it.", source: CS_GATES},
      {id: "gates.2", theme: "founder", text: "Larry Page and Sergey Brin developed PageRank here starting in 1996. An IEEE Milestone plaque on the fourth floor marks the birth of Google.", source: ETHW},
      {id: "gates.3", theme: "inside", text: "It brought Computer Science together from eight scattered campus sites into one building.", source: CS_GATES},
      {id: "gates.4", theme: "architecture", text: "Robert A. M. Stern Architects won a national competition to design it, and the 1969 Stanford Arm robot is on display inside.", source: E100_SPACES}
    ]
  },
  {
    id: "packard", name: "Packard Electrical Engineering Building", label: "Packard", namesake: "David Packard, HP co-founder",
    tags: ["tech founder", "electrical engineering", "hp"],
    facts: [
      {id: "packard.1", theme: "namesake", text: "It's named for HP co-founder David Packard. In 1994 he and Bill Hewlett gave 77.4 million dollars to finish rebuilding this part of campus.", source: E100_REDEV},
      {id: "packard.2", theme: "inside", text: "It's the home of Electrical Engineering, and its basement became the Stanford Robotics Lab in 2024.", source: E100_FUTURE},
      {id: "packard.3", theme: "architecture", text: "It opened in 1999 with a glass prow and aluminum siding, and no sandstone or arches, so passersby can see engineering at work.", source: E100_SPACES}
    ]
  },
  {
    id: "y2e2", name: "Y2E2, the Environment and Energy Building", label: "Y2E2", namesake: "Jerry Yang, Yahoo co-founder, and Akiko Yamazaki",
    tags: ["tech founder", "sustainability", "yahoo"],
    facts: [
      {id: "y2e2.1", theme: "namesake", text: "Y2E2 is named for Yahoo co-founder Jerry Yang and Akiko Yamazaki, both Stanford class of 1990, whose 50 million dollar gift made it possible.", source: E100_DESIGN},
      {id: "y2e2.2", theme: "architecture", text: "The building breathes: its windows open and close on their own with the temperature and wind, and it uses about 57 percent less energy than a typical building.", source: Y2E2_MAG},
      {id: "y2e2.3", theme: "inside", text: "Biologists, oceanographers, economists, engineers and policy experts share its labs, classrooms and cafe.", source: Y2E2_PLAT},
      {id: "y2e2.4", theme: "fun", text: "It was the first of the four new engineering quad buildings, finished in 2008, and later earned LEED Platinum.", source: Y2E2_PLAT}
    ]
  },
  {
    id: "shriram", name: "Shriram Center for Bioengineering and Chemical Engineering", label: "Shriram", namesake: "Ram and Vijay Shriram",
    tags: ["investor", "bioengineering"],
    facts: [
      {id: "shriram.1", theme: "namesake", text: "It's named for Stanford trustee and angel investor Ram Shriram and his wife Vijay.", source: SHRIRAM},
      {id: "shriram.2", theme: "inside", text: "Bioengineering and Chemical Engineering share 34 specialized labs here, and the first floor is almost entirely student space.", source: SHRIRAM},
      {id: "shriram.3", theme: "architecture", text: "At over 208,000 square feet it's the largest of the four quad buildings, and it uses about half the power of a typical building.", source: SHRIRAM},
      {id: "shriram.4", theme: "fun", text: "All four quad buildings share architects and connect underground, with shared kitchens and stairs designed for chance meetings between fields.", source: SHRIRAM}
    ]
  },
  {
    id: "spilker", name: "Spilker Engineering and Applied Sciences Building", label: "Spilker", namesake: "James Spilker Jr., GPS pioneer",
    tags: ["tech founder", "gps", "physics"],
    facts: [
      {id: "spilker.1", theme: "namesake", text: "It's named for GPS pioneer James Spilker Junior, who earned three Stanford degrees, and his wife Anna Marie.", source: SPILKER_DED},
      {id: "spilker.2", theme: "founder", text: "Spilker designed the civilian GPS signal and co-founded Stanford Telecommunications, growing it to about 1,300 people without venture capital.", source: SPILKER_OBIT},
      {id: "spilker.3", theme: "inside", text: "It houses Applied Physics and the Ginzton Lab, with much of the lab space underground to control vibration.", source: SPILKER_DED},
      {id: "spilker.4", theme: "fun", text: "Spilker shared the 2019 Queen Elizabeth Prize for Engineering for GPS and gave his share to Stanford Engineering. GPS is part of how this map knows where you are.", source: SPILKER_OBIT}
    ]
  },
  {
    id: "allen", name: "Paul G. Allen Building", label: "Allen", namesake: "the Paul G. Allen Foundation",
    tags: ["nanotech", "chips"],
    facts: [
      {id: "allen.1", theme: "namesake", text: "It opened in 1985 as the Center for Integrated Systems. A 1996 expansion funded by the Paul G. Allen Foundation gave it its name.", source: NANO},
      {id: "allen.2", theme: "inside", text: "It houses the Stanford Nanofabrication Facility, with a vibration-isolated cleanroom of more than 10,000 square feet.", source: NANO}
    ]
  },
  {
    id: "hewlett", name: "Hewlett Teaching Center", label: "Hewlett", namesake: "Bill Hewlett, HP co-founder",
    tags: ["tech founder", "lecture halls", "hp"],
    facts: [
      {id: "hewlett.1", theme: "namesake", text: "It's named for HP co-founder Bill Hewlett. His 1986 pledge of 50 million dollars was the largest individual pledge to Stanford at the time.", source: E100_REDEV},
      {id: "hewlett.2", theme: "architecture", text: "Together with the Packard building, it marks the entrance to the engineering quad.", source: E100_SPACES}
    ]
  },
  {
    id: "hoover", name: "Hoover Tower", label: "Hoover Tower", namesake: "Herbert Hoover",
    tags: ["landmark", "views"],
    facts: [
      {id: "hoover.1", theme: "architecture", text: "Hoover Tower is 285 feet tall. Arthur Brown Junior designed it, inspired by the cathedral tower in Salamanca, and it was finished in 1941 for Stanford's 50th anniversary.", source: HOOVER_AP},
      {id: "hoover.2", theme: "namesake", text: "Herbert Hoover, Stanford class of 1895, built it to house his archive on war and peace.", source: HOOVER_LOU},
      {id: "hoover.3", theme: "inside", text: "A carillon sits on the 14th floor, ringed by an observation deck with views across campus.", source: HOOVER_AP},
      {id: "hoover.4", theme: "fun", text: "The 48-bell carillon began as 35 bells from Belgium's pavilion at the 1939 New York World's Fair. The largest bell reads: For Peace Alone Do I Ring.", source: HOOVER_BELLS}
    ]
  },
  {
    id: "memchu", name: "Memorial Church", label: "Memorial Church", namesake: "Leland Stanford",
    tags: ["landmark", "founders"],
    facts: [
      {id: "memchu.1", theme: "namesake", text: "Jane Stanford built it between 1899 and 1903 in memory of her husband, Leland Stanford, as a church for all faiths.", source: MEMCHU},
      {id: "memchu.2", theme: "inside", text: "Its facade mosaic is 84 by 30 feet, the largest in America when it was installed, and the organ has more than 3,300 pipes.", source: MEMCHU},
      {id: "memchu.3", theme: "fun", text: "The 1906 earthquake brought its tower and spire down through the roof. They were never rebuilt.", source: MEMCHU},
      {id: "memchu.4", theme: "architecture", text: "It was designed by Charles Coolidge, just 28 years old, a protege of H. H. Richardson.", source: MEMCHU}
    ]
  },
  {
    id: "mainquad", name: "Main Quad", label: "Main Quad", namesake: "",
    tags: ["landmark", "founders"],
    facts: [
      {id: "mainquad.1", theme: "architecture", text: "Frederick Law Olmsted laid out the campus plan, and Shepley, Rutan and Coolidge designed the Quad, which opened with the university on October 1, 1891.", source: QUAD}
    ]
  },
  {
    id: "cantor", name: "Cantor Arts Center", label: "Cantor", namesake: "",
    tags: ["museum", "art"],
    facts: [
      {id: "cantor.1", theme: "fun", text: "It opened in 1894 as the Leland Stanford Junior Museum.", source: CANTOR}
    ]
  },
  {
    id: "hpgarage", name: "the HP Garage", label: "HP Garage", namesake: "",
    tags: ["tech founder", "hp", "silicon valley"],
    offMap: {lat: 37.44302, lon: -122.15464},
    facts: [
      {id: "hpgarage.1", theme: "founder", text: "At 367 Addison Avenue, Bill Hewlett and David Packard, encouraged by Stanford professor Frederick Terman, started HP in 1939. It's California Historical Landmark 976: the Birthplace of Silicon Valley.", source: HP_GARAGE}
    ]
  }
]

export function cardById(id: string): Card | undefined {
  for (const c of CARDS) if (c.id === id) return c
  return undefined
}

export function factById(id: string): {card: Card; fact: Fact} | undefined {
  for (const c of CARDS) for (const f of c.facts) if (f.id === id) return {card: c, fact: f}
  return undefined
}
