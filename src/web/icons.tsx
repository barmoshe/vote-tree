// Pixel icons on a 9x9 grid, drawn in currentColor with crisp edges. They replace every emoji:
// system emoji look different on every phone and break the pixel-art language.

const I: Record<string, string[]> = {
  tree: ["..xxxxx..", ".xxxxxxx.", "xxxxxxxxx", "xxxxxxxxx", ".xxxxxxx.", "...xxx...", "....x....", "....x....", "..xxxxx.."],
  trophy: ["xxxxxxxxx", "x.xxxxx.x", "x.xxxxx.x", ".xxxxxxx.", "...xxx...", "....x....", "....x....", "..xxxxx..", "..xxxxx.."],
  play: ["..x......", "..xx.....", "..xxx....", "..xxxx...", "..xxxxx..", "..xxxx...", "..xxx....", "..xx.....", "..x......"],
  help: ["..xxxxx..", ".xx...xx.", ".....xx..", "....xx...", "...xx....", "...xx....", ".........", "...xx....", "...xx...."],
  pot: ["....x....", "...xxx...", "..x.x.x..", "....x....", "xxxxxxxxx", ".x.....x.", ".x.....x.", "..x...x..", "..xxxxx.."],
  seed: ["....x....", "...xxx...", "..xxxxx..", "..xxxxx..", ".xxxxxxx.", ".xxxxxxx.", ".xxxxxxx.", "..xxxxx..", "...xxx..."],
  sprout: [".........", "xx.....xx", "xxx...xxx", ".xxx.xxx.", "..xxxxx..", "....x....", "....x....", "....x....", "..xxxxx.."],
  sapling: ["...xxx...", "..xxxxx..", ".xx.x.xx.", "xxx.x.xxx", "....x....", ".xx.x....", "..xxx....", "....x....", "..xxxxx.."],
  grove: [".xxx.....", "xxxxx.xxx", "xxxxxxxxx", ".xxx.xxxx", "..x..xxx.", "..x...x..", "..x...x..", "..x...x..", "xxxxxxxxx"],
  forest: ["...x.....", "..xxx..x.", "..xxx.xxx", ".xxxxxxxx", ".xxxxxxxx", "xxxxxxxxx", "...x...x.", "...x...x.", "xxxxxxxxx"],
  map: ["xxx...xxx", "x.xx.xx.x", "x..xxx..x", "x...x...x", "x...x...x", "x...x...x", "x..xxx..x", "x.xx.xx.x", "xxx...xxx"],
  drop: ["....x....", "....x....", "...xxx...", "..xxxxx..", ".xxxxxxx.", ".xx.xxxx.", ".xx.xxxx.", "..xxxxx..", "...xxx..."],
  flame: ["....x....", "...xx....", "...xxx.x.", "..xxxxxx.", ".xxxx.xx.", ".xxx..xxx", ".xx....xx", "..xx..xx.", "...xxxx.."],
  league: ["x........", "xxxxxxxx.", "xxxxxxx..", "xxxxxx...", "xxxxxxx..", "xxxxxxxx.", "x........", "x........", "x........"],
  hand: ["...x.x...", "..xx.xx..", "x.xx.xx.x", "xxxx.xxxx", "xxxxxxxxx", ".xxxxxxx.", ".xxxxxxx.", "..xxxxx..", "..xxxxx.."],
  generations: ["...xxx...", "...xxx...", "....x....", "..xxxxx..", "..x...x..", ".xxx.xxx.", ".xxx.xxx.", ".........", "........."],
  ballot: ["...xxx...", "...x.x...", "...x.x...", "xxxxxxxxx", "x..xxx..x", "x.......x", "x.xxxxx.x", "x.......x", "xxxxxxxxx"],
  stamp: ["...xxx...", "...xxx...", "...xxx...", "....x....", "..xxxxx..", ".xxxxxxx.", ".xxxxxxx.", ".........", "xxxxxxxxx"],
  sparkle: ["....x....", "....x....", "...xxx...", "xxxxxxxxx", "...xxx...", "....x....", "....x..x.", "......xxx", ".......x."],
  check: [".........", "........x", ".......xx", "......xx.", "x....xx..", "xx..xx...", ".xxxx....", "..xx.....", "........."],
  lock: ["..xxxxx..", ".xx...xx.", ".x.....x.", "xxxxxxxxx", "xxxx.xxxx", "xxxx.xxxx", "xxxx.xxxx", "xxxxxxxxx", "xxxxxxxxx"],
  calendar: [".x.....x.", "xxxxxxxxx", "xxxxxxxxx", "x.......x", "x.x.x.x.x", "x.......x", "x.x.x.x.x", "x.......x", "xxxxxxxxx"],
  share: ["....x....", "...xxx...", "..x.x.x..", "....x....", "....x....", "x...x...x", "x.......x", "x.......x", "xxxxxxxxx"],
  chat: [".xxxxxxx.", "xxxxxxxxx", "xx.....xx", "xx.xxx.xx", "xx.....xx", "xxxxxxxxx", ".xxxxxxx.", ".xx......", "x........"],
  copy: ["xxxxxx...", "x....x...", "x..xxxxxx", "x..x....x", "xxxx....x", "...x....x", "...x....x", "...xxxxxx", "........."],
  camera: [".........", "..xxx....", "xxxxxxxxx", "xxx...xxx", "xx.....xx", "xx.....xx", "xxx...xxx", "xxxxxxxxx", "........."],
  gift: ["..xx.xx..", "...x.x...", "xxxxxxxxx", "xxxxxxxxx", "....x....", ".xxx.xxx.", ".xxx.xxx.", ".xxx.xxx.", ".xxxxxxx."],
  key: [".xxx.....", "xx.xx....", "x...x....", "xx.xx....", ".xxxxxxxx", "......x.x", "......x.x", ".........", "........."],
  megaphone: [".......xx", ".....xxxx", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", ".x...xxxx", ".x.....xx", ".xx......", "........."],
  plus: ["....x....", "....x....", "....x....", "....x....", "xxxxxxxxx", "....x....", "....x....", "....x....", "....x...."],
  pause: [".xx...xx.", ".xx...xx.", ".xx...xx.", ".xx...xx.", ".xx...xx.", ".xx...xx.", ".xx...xx.", ".xx...xx.", ".xx...xx."],
  replay: ["..xxxxx..", ".x.....x.", "x.......x", "x.......x", "x.......x", "x....x..x", ".x...xx..", "..xxxxxx.", ".....xx.."],
  envelope: [".........", "xxxxxxxxx", "xx.....xx", "x.x...x.x", "x..x.x..x", "x...x...x", "x.......x", "xxxxxxxxx", "........."],
  hourglass: ["xxxxxxxxx", ".x.....x.", "..x...x..", "...xxx...", "....x....", "...x.x...", "..x.x.x..", ".xxxxxxx.", "xxxxxxxxx"],
  medal: ["xx.....xx", ".xx...xx.", "..xx.xx..", "...xxx...", "..xxxxx..", ".xxx.xxx.", ".xx...xx.", ".xxx.xxx.", "..xxxxx.."],
  flag: ["xxxxxxxxx", "x.......x", "xxxxxxxxx", "x...x...x", "x..x.x..x", "x...x...x", "xxxxxxxxx", "x.......x", "xxxxxxxxx"],
  logout: ["xxxxx....", "x........", "x.....x..", "x.....xx.", "x.xxxxxxx", "x.....xx.", "x.....x..", "x........", "xxxxx...."],
};

export function Icon({ name, size = 18, className = "", label }: { name: string; size?: number; className?: string; label?: string }) {
  const rows = I[name] ?? I.sparkle;
  // One path of unit squares keeps the DOM small.
  let d = "";
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === "x") d += `M${x} ${y}h1v1h-1z`;
  });
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 9 9" shapeRendering="crispEdges" fill="currentColor" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={d} />
    </svg>
  );
}
