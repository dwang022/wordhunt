// ─── Trie ─────────────────────────────────────────────────────────────────────
interface TrieNode { [key: string]: TrieNode | boolean; $?: boolean }

let TRIE: TrieNode = {};
let dictionaryLoaded = false;

function buildTrie(words: string[]): TrieNode {
  const root: TrieNode = {};
  for (const word of words) {
    let node = root;
    for (const ch of word) {
      if (!node[ch]) node[ch] = {} as TrieNode;
      node = node[ch] as TrieNode;
    }
    node.$ = true;
  }
  return root;
}

// Call once at app startup before rendering
export async function loadDictionary(): Promise<void> {
  if (dictionaryLoaded) return;
  try {
    const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
    const res = await fetch(`${SERVER_URL}/api/words`);
    const words: string[] = await res.json();
    TRIE = buildTrie(words);
    dictionaryLoaded = true;
    console.log(`Dictionary loaded: ${words.length} words`);
  } catch (err) {
    console.error('Failed to load dictionary from server, using fallback', err);
    // Minimal fallback so game still works offline
    const fallback = 'ace act add age ago aid aim air ale apt arc are arm art ash ask ate awe axe aye bad bag ban bar bat bay bed bid bit box boy bud bug bun bus but buy cab can cap car cat cod cop cow cry cup cut dab dam day den dig dim dip doe dog dot dry dub dug ear eat egg ego elm end era eve ewe eye fad fan far fat fib fig fin fit fix fly fog for fox fry gab gap gas gem get gin god got gum gun gut guy had ham has hat hay hem hen hew hid him hip hit hog hop hot how hub hug hum hut ice ill imp inn ion ire ivy jab jag jam jar jaw jay jet jig job jot joy jug jut keg key kid kin kit lab lad lag lap law lay led leg let lid lip lit log lot low lug mad man map mat may men met mob mod mop mud mug nab nag nap nip nit nod nor not now nun nut oak oar odd ode off oil old one opt orb ore our out owe owl own pad pan par pat paw pay pea peg pen pet pie pig pin pit pod pop pot ram ran rap rat raw ray red rib rid rig rim rip rob rod row rub rug rum run rut rye sad sag sap sat saw say sea set sew sin sip sir sit sob sod son sow sub sue sum sun tab tan tap tar tax tea ten tip toe ton top toy tub tug two urn use van vat via vie vim vow wad wag war was wax way web wed wig win wit woe won woo yak yam yap yew yen yes yet zap zip zoo able ache acid acre aged aide aims airs airy akin alms also alto amok apex arcs area aria arid arms back bags bail bait bale ball balm band bane bang bare bark barn base bash bass bath bead beak beam bean bear beat been beef beer bell belt bend bile bill bind bird bite blow blue blur boar boat bold bolt bond bone book boom boot bore born bowl brag brat brew brim brow buff bulk bull bump burn busy cage calm came camp cape card care carp cart case cash cast cave cell chap char chin chip chop claw clip clot club clue coal coat coil cola cold cord core cork corn cozy crab crew crop crow cult cure curl cute dark darn dart dash data date dawn deal dean dear deck deep deli dent dial dice dike dill dine dire disk dive dock dome done doom dove down drab draw drip drop drum duck duel dune dunk dusk dust earn ease east easy edge edit epic even ever exam exit face fact fail fair fake fall fame fang fare farm fast fate fear feat feed feel feet fell felt fend fern file fill film find fine fire firm fish fist flag flap flat flaw flea fled flog flop flow foam foal fold folk fond font food fool foot ford fore fork form fort foul four fowl fray free frog full fund fuse gale gall gape garb gate gave gaze gear geld gild glee glue goad goat gold gone good gore gown grab gram grim grin grip gust hail hair half hall halt hand hang hard hare harm hash hate haul have haze head heal heap heat heel held helm help herb herd here hide high hill hilt hire hold hole holy home hone hood hook horn hose host hour huge hull hulk hung hunk hunt hurt hymn icon idle inch into iris isle itch jack jade jail jest join joke jolt junk just keen keep kelp kick kiln kind king knit knob knot know lack lame lamp land lane lard lark lash last late lave lawn lead leaf leak lean leap lend lens levy lick life lift limb lime limp line link lion list live load loam loan lock loft loom loop lore loss lost love lull lump lung lurk lust mace made maid main make mane many mare mark mast mate maze meal mean meat meld melt menu mild mile milk mill mine mint miss mist moat mode mold mole molt monk mood moon moor mope more morn most much muse must mute name navy nerd nest next nice nick node none nook noon norm note noun null numb once only onto open opus orca oven over pace pack page paid pair pale pall palm pant pare park part past pave pawn peak pear peat peel peer pelt pest pick pier pile pine pink pint plan play plea plod plot plow poke poll pond pore port pose pout prey prod prop pulp pump pure push race rack raft rage rail rain rake ramp rang rank rant rash rate rave read real reap reed reef reel rely rend rent rest rife rift ring riot rise risk rite road roam roar robe rock role roof rook room root rope rose ruby rude ruin rule rump rune ruse rush rust safe saga sage sail sake sale same sand sane sang sash save scan scar self send sewn shed shin ship shoe shop shot show shut silk sill silt sing sink sire site slab slag slap sled slim slip slit slob slop slot slow slug slum smug snag snap snob snub soak soar sock sofa soil sold sole some song soot sore sort soul soup sour span spit stab stag star stay stem step stew stir stop stub stud stun suit sway swim tail tale talk tame tang tape tare taut teak teal tear teem tell tend tent term test that them then they thin thou tick tide till tilt time tine tool tore torn tote trap trek trim trio trod true tuck tune turf turn twin type vale vane vary vast veal veil vein verb very vest view vile vine visa wade waft wage wail wait wake walk wall wand wane want ward ware warm warn warp wart wash weed weep well welt went wide wife will wilt wind wine wing wink wipe wire wise wish wolf wore worm worn wren writ yell zone zoom'.split(' ');
    TRIE = buildTrie(fallback);
    dictionaryLoaded = true;
  }
}

export function isWord(word: string): boolean {
  let node = TRIE;
  for (const ch of word.toLowerCase()) {
    if (!node[ch]) return false;
    node = node[ch] as TrieNode;
  }
  return !!node.$;
}

export function hasPrefix(prefix: string): boolean {
  let node = TRIE;
  for (const ch of prefix.toLowerCase()) {
    if (!node[ch]) return false;
    node = node[ch] as TrieNode;
  }
  return true;
}

// GamePigeon scoring
const SCORE_MAP: Record<number, number> = { 3: 100, 4: 400, 5: 800, 6: 1400, 7: 1800, 8: 2200 };
export function wordScore(word: string): number {
  return SCORE_MAP[Math.min(word.length, 8)] ?? 2200;
}

export function isAdjacent(a: number, b: number): boolean {
  const ar = Math.floor(a / 4), ac = a % 4;
  const br = Math.floor(b / 4), bc = b % 4;
  return Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1 && a !== b;
}

export function getRank(elo: number) {
  if (elo < 1000) return { name: 'Novice',      icon: '🔰', color: '#8b8bff' };
  if (elo < 1200) return { name: 'Scholar',     icon: '📚', color: '#7dff7d' };
  if (elo < 1500) return { name: 'Wordsmith',   icon: '✍️', color: '#ffdd7d' };
  if (elo < 1800) return { name: 'Lexicon',     icon: '📖', color: '#ff9d7d' };
  return               { name: 'Grandmaster', icon: '👑', color: '#dd7dff' };
}
