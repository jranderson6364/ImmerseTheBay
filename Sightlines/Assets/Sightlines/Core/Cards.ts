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

// Wider-tour cards, checked Nov 14 2026 by fetching each page and matching the supporting sentence.
// Kept out (no opened source): Varian Associates and Fairchild founding, Moore's gift year, who Ruth Wattis
// Mitchell was, Lathrop's namesake, Sequoia's architect, Tresidder's opening year (sources say 1960 and 1962), the bookstore's
// 1897 founding, Littlefield's current tenants, the Hoover Memorial and Lou Henry Hoover buildings.
const ACCESS = (facil: string) => `https://maps.stanford.edu/ada/building-ada.cfm?FACIL_ID=${facil}`
const VARIAN_PCAD = "https://pcad.lib.washington.edu/building/8147/"
const GINZTON = "https://ginzton.stanford.edu/about-lab/history"
const MOORE_SR = "https://news.stanford.edu/stories/2023/04/stanford-remembers-gordon-moore"
const MCCULLOUGH_PCAD = "https://pcad.lib.washington.edu/building/20246/"
const DURAND_HERO = "https://engineering.stanford.edu/about/history/heroes/2011-heroes/william-f-durand"
const SEQUOIA_DED = "https://statistics.stanford.edu/events/special-events/dedication-new-sequoia-hall"
const DOERR_VISIT = "https://sustainability.stanford.edu/visit-us"
const CECIL_GREEN ="https://library.stanford.edu/news/remembering-cecil-h-green"
const GILBERT_BIO = "https://seaside.stanford.edu/gilbert"
const CLARK_BIOX = "https://biox.stanford.edu/about/clark-center"
const CLARK_GIFT = "https://biox.stanford.edu/highlight/entrepreneur-jim-clark-donate-60-million-interdisciplinary-research-stanford"
const LKS = "https://med.stanford.edu/news/all-news/2010/09/li-ka-shing-center-dedication-marks-new-era-in-medical-education.html"
const CODA_SR = "https://news.stanford.edu/stories/2025/02/coda-marks-new-era-for-computing-and-data-science-at-stanford"
const CODA_LMN = "https://lmnarchitects.com/project/computing-and-data-science-building-stanford-university"
const BASS_SR = "https://news.stanford.edu/stories/2019/03/bass-biology-provides-new-home-life-sciences-stanford"
const SAPP_SR = "https://news.stanford.edu/stories/2016/09/old-chemistry-named-sapp-center-science-teaching-learning"
const SHS_TRIVIA = "https://historicalsociety.stanford.edu/trivia"
const OLD_UNION = "https://tresidder.stanford.edu/old-union-complex"
const TRESIDDER_MAG = "https://stanfordmag.org/contents/tresidder"
const GREEN_DAILY = "https://stanforddaily.com/2019/08/03/100-years-after-opening-green-library-is-still-guided-by-the-vision-of-jane-stanford/"
const LATHROP_DAILY = "https://stanforddaily.com/2014/08/25/meyer-library-closes-permanently-relocating-services-to-lathrop/"
const EAST_ASIA_LIB = "https://library.stanford.edu/libraries/east-asia-library"
const BOOKSTORE_SR = "https://news.stanford.edu/stories/2018/05/campus-community-invited-consider-bookstore-future"
const LITTLEFIELD_GSB = "https://www.gsb.stanford.edu/experience/news-history/history/littlefield-management-center"

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
  },

  // ---- Science and Engineering Quad and its west side ----
  {
    id: "varian", name: "Varian Physics Laboratory", label: "Varian Physics", namesake: "Russell H. Varian, klystron co-inventor",
    tags: ["physics", "inventor"],
    facts: [
      {id: "varian.1", theme: "namesake", text: "Its full name is the Russell H. Varian Laboratory of Physics, built in 1962 and 1963 to a design by architect Gardner Dailey.", source: VARIAN_PCAD},
      {id: "varian.2", theme: "founder", text: "In 1937 Russell and Sigurd Varian, working with William Hansen in the basement of Stanford's old physics building, demonstrated the klystron, the first very-high-frequency source, for radar and direction finding.", source: GINZTON},
      {id: "varian.3", theme: "inside", text: "It's home to the Physics department and the Hansen Experimental Physics Lab, with the Stanford Institute for Theoretical Physics on the third floor.", source: ACCESS("04-520")}
    ]
  },
  {
    id: "moore", name: "Gordon and Betty Moore Materials Research Building", label: "Moore", namesake: "Gordon Moore, Intel founder, and Betty Moore",
    tags: ["tech founder", "materials", "intel"],
    facts: [
      {id: "moore.1", theme: "namesake", text: "Intel founder Gordon Moore and his wife Betty made the naming gift for this materials research building.", source: MOORE_SR},
      {id: "moore.2", theme: "inside", text: "It houses the Geballe Laboratory for Advanced Materials, an independent lab for research on advanced materials across science and engineering.", source: ACCESS("04-480")}
    ]
  },
  {
    id: "mccullough", name: "McCullough Building", label: "McCullough", namesake: "Jack McCullough, vacuum tube pioneer",
    tags: ["materials", "inventor"],
    facts: [
      {id: "mccullough.1", theme: "namesake", text: "Dedicated in October 1965 as the home of Materials Science, it was made possible by a 1.5 million dollar grant from vacuum tube pioneer Jack McCullough and his wife, and from DARPA.", source: E100_SPACES},
      {id: "mccullough.2", theme: "inside", text: "It holds the Geballe Lab's equipment for electrical, magnetic and optical measurements of new materials.", source: ACCESS("04-490")},
      {id: "mccullough.3", theme: "architecture", text: "San Francisco architect Gardner Dailey designed it, the same architect as the Varian physics building.", source: MCCULLOUGH_PCAD}
    ]
  },
  {
    id: "durand", name: "William F. Durand Building", label: "Durand", namesake: "William F. Durand, aviation pioneer",
    tags: ["aerospace", "engineering"],
    facts: [
      {id: "durand.1", theme: "namesake", text: "It opened in 1969, named for Stanford professor William F. Durand, whose propeller research led to the first variable pitch propeller.", source: E100_SPACES},
      {id: "durand.2", theme: "inside", text: "It's the home of Aeronautics and Astronautics, along with the Stanford Center for Professional Development.", source: ACCESS("04-540")},
      {id: "durand.3", theme: "fun", text: "Durand joined the Stanford faculty in 1904 and began studying aviation when it was a brand-new field.", source: DURAND_HERO}
    ]
  },
  {
    id: "sequoia", name: "Sequoia Hall", label: "Sequoia", namesake: "",
    tags: ["statistics", "data"],
    facts: [
      {id: "sequoia.1", theme: "inside", text: "Sequoia Hall is home to the Statistics department and its Girshick library.", source: ACCESS("04-530")},
      {id: "sequoia.2", theme: "fun", text: "The new Sequoia Hall was dedicated on January 17, 1998, with remarks from President Gerhard Casper and Provost Condoleezza Rice.", source: SEQUOIA_DED}
    ]
  },
  {
    id: "greenearth", name: "Green Earth Sciences Building", label: "Green Earth Sciences", namesake: "Cecil and Ida Green, Texas Instruments",
    tags: ["tech founder", "earth sciences"],
    facts: [
      {id: "greenearth.1", theme: "founder", text: "Cecil Green co-founded Texas Instruments in 1951. He never attended Stanford, but he and his wife Ida helped fund its Earth Sciences research building.", source: CECIL_GREEN},
      {id: "greenearth.2", theme: "inside", text: "It houses departments of the School of Earth Sciences: offices, labs and classrooms.", source: ACCESS("04-460")},
      {id: "greenearth.3", theme: "namesake", text: "Its full name is the Cecil H. and Ida M. Green Earth Sciences Research Building.", source: DOERR_VISIT}
    ]
  },
  {
    id: "mitchell", name: "Mitchell Earth Sciences Building", label: "Mitchell", namesake: "Ruth Wattis Mitchell",
    tags: ["earth sciences", "library"],
    facts: [
      {id: "mitchell.1", theme: "inside", text: "Mitchell houses Earth Sciences departments, with the Branner Earth Sciences Library on the second floor.", source: ACCESS("04-560")},
      {id: "mitchell.2", theme: "namesake", text: "Its full name is the Ruth Wattis Mitchell Earth Sciences Building.", source: DOERR_VISIT}
    ]
  },
  {
    id: "gilbert", name: "Gilbert Biological Sciences Building", label: "Gilbert", namesake: "Charles Henry Gilbert, zoologist",
    tags: ["biology"],
    facts: [
      {id: "gilbert.1", theme: "inside", text: "Officially the Charles H. Gilbert Biological Sciences Building, it houses the Biology department.", source: ACCESS("07-420")},
      {id: "gilbert.2", theme: "namesake", text: "Charles Henry Gilbert met David Starr Jordan as his high school teacher and became his close colleague for much of his adult life. His doctorate, earned at 24, was the first Indiana University ever awarded.", source: GILBERT_BIO}
    ]
  },
  {
    id: "clark", name: "James H. Clark Center", label: "Clark Center", namesake: "Jim Clark, Silicon Graphics and Netscape founder",
    tags: ["tech founder", "bio-x", "netscape"],
    facts: [
      {id: "clark.1", theme: "namesake", text: "Jim Clark, founder of Silicon Graphics and Netscape, made a 90 million dollar lead gift in 1999 that made the building possible. It's the home of Bio-X.", source: CLARK_GIFT},
      {id: "clark.2", theme: "architecture", text: "Foster and Partners designed it with MBT Architecture. It opened in 2003, with three wings wrapped around a courtyard.", source: CLARK_BIOX},
      {id: "clark.3", theme: "fun", text: "Under the courtyard's circular stage is a round auditorium with 150 cardinal-red seats.", source: CLARK_BIOX}
    ]
  },
  {
    id: "likashing", name: "Li Ka Shing Center for Learning and Knowledge", label: "Li Ka Shing", namesake: "Li Ka-shing, Hong Kong business leader",
    tags: ["medicine", "simulation"],
    facts: [
      {id: "likashing.1", theme: "inside", text: "It's the hub of the medical school's teaching. The ground floor holds a 28,000 square foot center for simulation and immersive learning.", source: LKS},
      {id: "likashing.2", theme: "architecture", text: "Designed by NBBJ, the five-story building welcomed its first students on August 16, 2010.", source: LKS}
    ]
  },
  {
    id: "coda", name: "Computing and Data Science Building", label: "CoDa", namesake: "",
    tags: ["computer science", "data"],
    facts: [
      {id: "coda.1", theme: "architecture", text: "CoDa's two wings, one rectangular and one oval, stand for the ones and zeros of binary code. LMN Architects designed it.", source: CODA_SR},
      {id: "coda.2", theme: "inside", text: "At its core is the Hive, a central mixing space wrapped around a cross-directional feature stair.", source: CODA_LMN},
      {id: "coda.3", theme: "fun", text: "It totals 167,000 square feet, and the whole fourth floor of the west wing is a conference centre for up to 200 people.", source: CODA_SR}
    ]
  },
  {
    id: "bassbio", name: "Bass Biology Research Building", label: "Bass Biology", namesake: "Anne T. and Robert M. Bass",
    tags: ["biology"],
    facts: [
      {id: "bassbio.1", theme: "namesake", text: "It was made possible by a gift from Anne T. Bass and Robert M. Bass, longtime Stanford volunteers and donors.", source: BASS_SR},
      {id: "bassbio.2", theme: "inside", text: "Its 133,000 square feet mix wet labs for hands-on research with computational dry labs, all for the Biology department.", source: BASS_SR},
      {id: "bassbio.3", theme: "architecture", text: "Flad Architects and Ennead Architects designed its two limestone-clad wings, joined by an enclosed bridge.", source: BASS_SR}
    ]
  },
  {
    id: "sapp", name: "Sapp Center for Science Teaching and Learning", label: "Sapp Center", namesake: "Shari and Rick Sapp",
    tags: ["chemistry", "history"],
    facts: [
      {id: "sapp.1", theme: "fun", text: "This is Old Chem, built from 1900 to 1902. After the 1989 Loma Prieta earthquake it sat behind a hurricane fence for almost 30 years.", source: SAPP_SR},
      {id: "sapp.2", theme: "namesake", text: "Restored as a science teaching center, it was renamed for Shari and Rick Sapp, Stanford class of 1978, and their family.", source: SAPP_SR},
      {id: "sapp.3", theme: "inside", text: "Its fourth floor is now a study space overlooking the Oval.", source: SAPP_SR}
    ]
  },

  // ---- Central campus ----
  {
    id: "oldunion", name: "Old Union", label: "Old Union", namesake: "",
    tags: ["student life", "history"],
    facts: [
      {id: "oldunion.1", theme: "fun", text: "Its three buildings went up between 1915 and 1923 as women's dorms and Stanford's first student union.", source: SHS_TRIVIA},
      {id: "oldunion.2", theme: "architecture", text: "Bakewell and Brown, who also designed Green Library, gave it its Spanish Colonial look.", source: SHS_TRIVIA},
      {id: "oldunion.3", theme: "inside", text: "Today it's a central hub for student activities.", source: OLD_UNION}
    ]
  },
  {
    id: "tresidder", name: "Tresidder Memorial Union", label: "Tresidder", namesake: "Donald Tresidder, Stanford's fourth president",
    tags: ["student life", "food"],
    facts: [
      {id: "tresidder.1", theme: "namesake", text: "It's named for Donald Tresidder, Stanford's fourth president, who earlier ran the Yosemite Park and Curry Company.", source: TRESIDDER_MAG},
      {id: "tresidder.2", theme: "architecture", text: "Architect Bill Busse gave it a meandering shape to fit around four huge oak trees. Only two survive.", source: TRESIDDER_MAG},
      {id: "tresidder.3", theme: "fun", text: "Students helped pay for it through an assessment that covered part of its 2.675 million dollar cost.", source: TRESIDDER_MAG}
    ]
  },
  {
    id: "greenlib", name: "Green Library, Bing Wing", label: "Green Library", namesake: "Cecil Green, and Peter and Helen Bing",
    tags: ["library", "history"],
    facts: [
      {id: "greenlib.1", theme: "fun", text: "This wing is Stanford's original Main Library. When it opened in 1919 it had room for more than 700,000 books.", source: GREEN_DAILY},
      {id: "greenlib.2", theme: "namesake", text: "After the 1989 earthquake, Stanford rebuilt this wing instead of demolishing it. The work, funded mainly by Peter and Helen Bing, finished in 1999, and it became the Bing Wing.", source: GREEN_DAILY},
      {id: "greenlib.3", theme: "founder", text: "Texas Instruments co-founder Cecil Green and his wife Ida were the main donors for the library's East Wing, and the whole library now bears his name.", source: CECIL_GREEN}
    ]
  },
  {
    id: "lathrop", name: "Lathrop Library", label: "Lathrop", namesake: "",
    tags: ["library", "study"],
    facts: [
      {id: "lathrop.1", theme: "inside", text: "Lathrop Library was converted in 2014 from the business school's former South Building. It holds a 24-hour study space and a digital language lab.", source: LATHROP_DAILY},
      {id: "lathrop.2", theme: "inside", text: "The East Asia Library moved to its second floor when Meyer Library closed in 2014.", source: EAST_ASIA_LIB}
    ]
  },
  {
    id: "bookstore", name: "Stanford Bookstore", label: "Bookstore", namesake: "",
    tags: ["student life", "shopping"],
    facts: [
      {id: "bookstore.1", theme: "fun", text: "The Stanford Bookstore has stood in White Plaza since 1960.", source: BOOKSTORE_SR}
    ]
  },
  {
    id: "littlefield", name: "Littlefield Center", label: "Littlefield", namesake: "Edmund W. Littlefield, business executive",
    tags: ["business", "history"],
    facts: [
      {id: "littlefield.1", theme: "namesake", text: "It's named for San Francisco executive Edmund Littlefield, a 1938 Stanford MBA, who gave the lead gift of about 5 million dollars.", source: LITTLEFIELD_GSB},
      {id: "littlefield.2", theme: "architecture", text: "Kohn Pedersen Fox designed it for the business school. Its 60,000 square feet held offices for most of the school's faculty, plus classrooms.", source: LITTLEFIELD_GSB}
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
