// Everything Coach Rex says. Each line is recorded ahead of time into an
// audio clip (see scripts/voice/generate.py), so the game never synthesises
// speech while it runs. Lines that say Zef's name have a name-free twin used
// if a grown-up changes the name, and lines that say "twenty nights" have a
// twin without the number for when a grown-up changes the goal.

export interface Line {
  text: string;
  /** used instead when the child's name isn't Zef */
  nameless?: string;
  /** used instead when the goal isn't twenty dry nights in a row */
  anyGoal?: string;
}

/** The goal the lines with a number in them were recorded for. */
export const SPOKEN_GOAL = 20;

export const LINES: Record<string, Line> = {
  // ---------------------------------------------------------- first time
  'intro-1': { text: "Hey, big guy! I'm Coach Rex! I heard you're on a super important mission!" },
  'intro-2': { text: "You're learning to stay dry at night, so you can wear underwear to bed instead of diapers! That's a big deal! And you know what? I know you can do it!" },
  'intro-3': { text: "Here's how it works. Every morning, you press a button. Dry night? You get a big shiny star, and we hop ahead on our adventure!" },
  'intro-4': { text: "Not dry? That's okay! You get a big dino hug, and we'll try again!" },
  'intro-prizes': { text: "And along the way, you'll win fun prizes for staying dry! Get enough stars, and you get to open a treasure chest!" },
  'intro-meter': {
    text: "Now, see this meter? Every dry night in a row fills it up. Stay dry twenty nights in a row, and it's all the way full! That means you're ready to wear underwear at night!",
    anyGoal: "Now, see this meter? Every dry night in a row fills it up. When it's all the way full, that means you're ready to wear underwear at night!",
  },
  'intro-store': { text: 'And then? We fly to the Underwear Store, way up on that mountain! You get to pick out underwear for your dino, so you can both wear underwear at night!' },
  'intro-go': { text: "Ready? Let's do this!" },
  'pick-dino': { text: 'First, pick your dino! Which one is you?' },
  'picked-trex': { text: 'A T. rex! Rawr! Great choice!' },
  'picked-trike': { text: 'A triceratops! Three horns, triple awesome!' },
  'picked-stego': { text: 'A stegosaurus! Look at those cool spikes!' },
  'picked-longneck': { text: 'A long-neck! You can see everything from up there!' },
  'pick-color': { text: 'Now pick your color!' },
  'color-done': { text: "Looking good! Let's go!" },

  // ---------------------------------------------------------- mornings
  'greet-1': { text: 'Good morning, Zef!', nameless: 'Good morning, big guy!' },
  'greet-2': { text: 'Rise and shine, Zef!', nameless: 'Rise and shine, buddy!' },
  'greet-3': { text: 'Good morning, big guy!' },
  ask: { text: 'Did you stay dry last night? Press the sun if you did, or the heart for a big hug!' },
  'ask-short': { text: 'Did you stay dry last night?' },
  already: { text: 'Hey, Zef! You already pressed the button today. See you tomorrow morning!', nameless: 'Hey, buddy! You already pressed the button today. See you tomorrow morning!' },

  // ---------------------------------------------------------- dry
  'dry-1': { text: 'Yes! You stayed dry! Woo-hoo!' },
  'dry-2': { text: "Dry night! That's what I'm talking about!" },
  'dry-3': { text: 'Whoa, you did it! Way to go, big guy!' },
  'dry-4': { text: "Dry again! You're a superstar!" },
  'dry-5': { text: 'Boom! Another dry night! Yeah, buddy!' },
  'dry-6': { text: "Yeah! You're doing amazing, Zef!", nameless: "Yeah! You're doing amazing, buddy!" },
  'first-star': { text: 'Your very first star! This is the start of something awesome!' },
  hop: { text: 'Hop, hop, hop!' },

  // ---------------------------------------------------------- surprises
  egg: { text: 'Ooh, look! A mystery egg! Tap it to crack it open!' },
  'egg-tap': { text: 'Keep tapping!' },
  'egg-done': { text: 'Whoa! Look what was inside! Tap the big button to collect it!' },
  'acc-cap': { text: 'A baseball cap! Looking sharp!' },
  'acc-shades': { text: 'Sunglasses! Too cool!' },
  'acc-soccer': { text: 'A soccer ball! Goal!' },
  'acc-jersey': { text: 'A basketball jersey! Slam dunk!' },
  'acc-party': { text: "A party hat! Let's party!" },
  'acc-bowtie': { text: 'A bow tie! So fancy!' },
  'acc-cowboy': { text: 'A cowboy hat! Yee-haw!' },
  'acc-cape': { text: 'A superhero cape! Super dino!' },
  'acc-crown': { text: "A crown! You're the king of the dinos!" },
  'acc-basketball': { text: 'A basketball! Swish!' },
  'acc-propeller': { text: 'A propeller hat! Up, up and away!' },
  'acc-medal': { text: 'A gold medal! Number one!' },
  'acc-sneakers': { text: 'Sneakers! Super speedy feet!' },
  'acc-sweatband': { text: 'A sweatband! Ready for the big game!' },
  'acc-football': { text: 'A football! Touchdown!' },
  'acc-pirate': { text: 'A pirate hat! Arr, matey!' },
  'acc-scarf': { text: 'A cozy scarf! Nice and warm!' },
  'acc-tutu': { text: 'A tutu! Twirl, twirl, twirl!' },
  'acc-chef': { text: "A chef hat! What's cooking?" },
  'acc-viking': { text: 'A viking helmet! So brave!' },
  'acc-trophy': { text: "A trophy! You're a champion!" },
  'acc-wizard': { text: 'A wizard hat! Abracadabra!' },
  'acc-boots': { text: 'Rain boots! Splish, splash!' },
  'acc-goggles': { text: 'Swim goggles! Ready to splash!' },
  highfive: { text: 'Up top! Give me a high five!' },
  'highfive-done': { text: 'Ooh, that was a good one!' },
  dance: { text: 'Dance party! Show me your silliest dino dance!' },
  'dance-done': { text: 'Ha! Those are some sweet moves!' },
  roar: { text: "Let's hear your biggest dino roar! Tap your dino to roar!" },
  'roar-more': { text: 'Louder!' },
  'roar-done': { text: 'Whoa! That was the biggest roar ever!' },

  // ---------------------------------------------------------- meter
  'meter-up': { text: 'Look! Your meter is filling up!' },
  'meter-half': { text: 'Your meter is halfway full! Underwear at night, here we come!' },
  'meter-3': { text: "Only three more dry nights, and you're ready for underwear at night!" },
  'meter-2': { text: 'Just two more dry nights to go!' },
  'meter-1': { text: 'Just one more dry night! You can do it!' },

  // ---------------------------------------------------------- chests
  'chest-reach': { text: "You made it to the treasure chest! Tap it and see what's inside!" },
  'prize-candy': { text: 'You earned... candy! Go tell your grown-up!' },
  'prize-movie': { text: 'You earned... movie night! Go tell your grown-up!' },
  'prize-mcdonalds': { text: "You earned... McDonald's! Go tell your grown-up!" },
  'prize-squishy': { text: 'You earned... a squishy! Go tell your grown-up!' },
  'prize-pizza': { text: 'You earned... a pizza party! Go tell your grown-up!' },
  'prize-icecream': { text: 'You earned... ice cream! Go tell your grown-up!' },
  'prize-toy': { text: 'You earned... a new toy! Go tell your grown-up!' },
  'prize-park': { text: 'You earned... a trip to the park! Go tell your grown-up!' },
  'prize-book': { text: 'You earned... a new book! Go tell your grown-up!' },
  'prize-gift': { text: 'You earned a prize! Go tell your grown-up!' },
  'land-0': { text: 'Next stop: Jungle Jumble!' },
  'land-1': { text: 'Next stop: Volcano Valley!' },
  'land-2': { text: 'Next stop: Splashy Lagoon!' },
  'land-3': { text: 'Next stop: Fossil Canyon!' },
  'land-4': { text: 'Next stop: Snowball Mountain!' },
  'land-5': { text: 'Next stop: Crystal Caves!' },
  'land-6': { text: 'Next stop: Rainbow Meadow!' },

  // ---------------------------------------------------------- the store
  'store-open': {
    text: "Wow, Zef! You did it! Your meter is all the way full! That means you're ready to wear underwear at night! And the Underwear Store is open!",
    nameless: "Wow! You did it! Your meter is all the way full! That means you're ready to wear underwear at night! And the Underwear Store is open!",
  },
  'store-fly': { text: "Hop on! Let's fly!" },
  'store-pick': { text: 'Welcome to the Underwear Store! Pick out some underwear for your dino!' },
  'store-picked': { text: 'Ooh! Those are awesome!' },
  'store-done': { text: "Now you and your dino can both wear underwear at night! Go show your grown-up! I'm so proud of you!" },

  // ---------------------------------------------------------- not dry
  'wet-1': { text: "Hey, that's okay, big guy. Your body's still practicing." },
  'wet-2': { text: 'Come here! Big dino hug! My arms are tiny, but my hugs are huge!' },
  'wet-3': { text: "And look! You still have all your stars! Tonight's a brand new try!" },
  'wet-4': { text: "No worries, buddy. Every dino has nights like that. You're still my favorite dino!" },

  // ---------------------------------------------------------- goodbye
  'bye-1': { text: 'See you tomorrow morning, big guy!' },
  'bye-2': { text: 'Have an awesome day, Zef! See you tomorrow!', nameless: 'Have an awesome day, buddy! See you tomorrow!' },
  'bye-3': { text: "Don't forget to go potty before bed! See you in the morning!" },

  // ---------------------------------------------------------- taps
  'tap-1': { text: 'Hey there!' },
  'tap-2': { text: "You're awesome!" },
  'tap-3': { text: 'Ha ha! That tickles!' },
  'tap-4': { text: 'Rawr!' },
};

export type LineId = keyof typeof LINES;

/** Which recording of a line fits this child: the usual one or a twin. */
function twin(l: Line, name: string, goal: number): 'nameless' | 'anygoal' | null {
  if (l.nameless && !isZef(name)) return 'nameless';
  if (l.anyGoal && goal !== SPOKEN_GOAL) return 'anygoal';
  return null;
}

/** The text actually spoken for a child called `name` with this goal. */
export function lineText(id: string, name: string, goal = SPOKEN_GOAL): string {
  const l = LINES[id];
  if (!l) return '';
  const t = twin(l, name, goal);
  return t === 'nameless' ? l.nameless! : t === 'anygoal' ? l.anyGoal! : l.text;
}

export function isZef(name: string): boolean {
  return name.trim().toLowerCase() === 'zef';
}

/** Which audio clip to play: the usual one, or its name-free or number-free twin. */
export function clipId(id: string, name: string, goal = SPOKEN_GOAL): string {
  const l = LINES[id];
  const t = l ? twin(l, name, goal) : null;
  return t ? `${id}--${t}` : id;
}
