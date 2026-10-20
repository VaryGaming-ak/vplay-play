/* vplay lite: shared palette and pixel-art sprites (ES5).
   One palette for every game, like the 16-colour PNGs of Series 40 games.
   '.' is transparent. 'X' is swapped for a colour at draw time. */
var ART = {
  PAL: {
    k: '#141414', w: '#ffffff', g: '#9aa0a8', G: '#4a4f58', r: '#e03c32', R: '#9c1c1c', o: '#f28c18', O: '#b85c08',
    y: '#ffd23c', Y: '#c99a12', l: '#5fd35a', n: '#1e8a3c', N: '#0f5228', b: '#3a8ef0', B: '#1c3e9c', c: '#8fd8ff',
    t: '#22a6a0', T: '#126a66', p: '#9a4fd0', P: '#5a2a8a', m: '#ff7fb0', M: '#c2407a', u: '#8a5a2e', U: '#55361a',
    s: '#f4dca6', S: '#d9b77a', q: '#101a3a', Q: '#22305e'
  },
  SPR: {
    /* Chop Chop */
    chop_hero: ['....nn....', '..kkkkkk..', '.kooooyok.', 'koooowwook', 'kooookwook', 'kooooooook', 'koooRRRook', '.kooRRook.', '..kkkkkk..', '..k....k..'],
    chop_goat: ['k........k', 'gk......kg', '.gkkkkkkg.', '.kwwwwwwk.', 'kwwkwwkwwk', 'kwwwwwwwwk', '.kwwssswk.', '.kwskkswk.', '..kwwwwk..', '...kkkk...'],
    chop_nut: ['..........', '..........', '..........', '....ss....', '....Ss....', '....ss....', '....sS....', '..........', '..........', '..........'],
    chop_pep: ['..........', '.....n....', '....nn....', '...rrr....', '..rrwrr...', '..rrrrr...', '...rrrr...', '....rrR...', '.....R....', '..........'],
    chop_wall: ['TTTTTTTTTT', 'tttttTtttt', 'tttttTtttt', 'TTTTTTTTTT', 'ttTttttttT', 'ttTttttttT', 'TTTTTTTTTT', 'tttttTtttt', 'tttttTtttt', 'TTTTTTTTTT'],
    /* Harmattan Skies (15 x 10 cells) */
    harm_drone: ['......kkk......', '....kkXXXkk....', '...kXXXXXXXk...', '..kXXkwwwkXXk..', '.kXXXkwkwkXXXk.', 'kXXXXXkkkXXXXXk', '.kkXXXXXXXXXkk.', '..k.kX.X.Xk.k..', '..k..k.k.k..k..', '...............'],
    harm_ship: ['.......r.......', '......kwk......', '......kwk......', '.....kwbwk.....', '.....kwbwk.....', '....kwwwwwk....', '...krkwwwkrk...', '..krrkwgwkrrk..', '..kkkkkkkkkkk..', '......oyo......'],
    harm_bomb: ['.......y.......', '......yYy......', '......yYy......', '......yYy......', '.......y.......', '...............', '...............', '...............', '...............', '...............'],
    /* Road Crossa (15 x 10 cells) */
    road_chick: ['.......rr......', '......kkkk.....', '.....kwwwwk....', '.....kwkwwkoo..', '..kk.kwwwwk....', '.kwwkkwwwwk....', '.kwwwwwwwwk....', '..kwwwwwwk.....', '...kkokok......', '....o..o.......'],
    road_car: ['...............', '....kkkkkkk....', '...kXcckcckXk..', '..kXXcckcckXXk.', '.kXXXXXXXXXXXXk', '.kXXXXXXXXXXXyk', '.kkkkkkkkkkkkkk', '...kGGk..kGGk..', '....kk....kk...', '...............'],
    /* Coconut Climb */
    coco_hero: ['...kkkk...', '..kUUUUk..', '..kUssks..', '..ksssss..', '...kkkk...', '..krrrrk..', '.ksrrrrsk.', '..kBBBBk..', '..kBk.kB..', '..kk..kk..'],
    coco_nut: ['..........', '...kkkk...', '..kUuuuk..', '.kUuuuuSk.', '.kUuSuuuk.', '.kUuuuuuk.', '.kUUuuuuk.', '..kUUUuk..', '...kkkk...', '..........'],
    coco_ball: ['..........', '...kkkk...', '..kwkkwk..', '.kwwkkwwk.', '.kkwwwwkk.', '.kwwkkwwk.', '.kwkkkkwk.', '..kwwwwk..', '...kkkk...', '..........'],
    coco_bird: ['...yyyy.............', '..yoooOy............', '.kkkkkkkk...........', 'kQQQQwkQQk..........', 'kQQQQkkQQkyyyyy.....', 'kQQQQQQQQkyyyyyyyy..',
      'kQQQQQQQQkyyyyyyyyy.', 'kQQQQQQQQkkyyyyyyy..', 'kQwwwwwQQk.kkkkkk...', 'kQwwwwwwQQk.........', '.kQwwwwwQQk.........', '..kQQQQQQQk.........',
      '...kkkkkkkk.........', '....kY..kY..........', '....kY..kY..........', '...kkk.kkk..........'],
    /* Mamba Munch */
    mam_head: ['..kkkkk...', '.knnnnnk..', 'knnnnwkkk.', 'knlnnnnnnk', 'knnnnnnnnk', 'knnnnnnnnk', 'knlnnnnnnk', 'knnnnwkkk.', '.knnnnnk..', '..kkkkk...'],
    mam_body: ['.kkkkkkkk.', 'knnnnnnnnk', 'knNnnnnNnk', 'knnNnnNnnk', 'knnnyynnnk', 'knnnyynnnk', 'knnNnnNnnk', 'knNnnnnNnk', 'knnnnnnnnk', '.kkkkkkkk.'],
    mam_egg: ['..........', '....kk....', '...kwwk...', '..kwwwck..', '..kwcwwk..', '.kwwwwwwk.', '.kwwwcwwk.', '.kwwwwwwk.', '..kkkkkk..', '..........'],
    /* Penalty King */
    pen_keeper: ['.....kkkk.....', '....kUUUUk....', '....kskssk....', '....kssssk....', '.....kkkk.....', 'kkkXXXXXXXXkkk', 'kwXXXXXXXXXXwk', 'kk.kXXXXXXk.kk',
      '...kXXXXXXk...', '...kXXXXXXk...', '...kBBBBBBk...', '...kBBkkBBk...', '...kssk.ksk...', '...kssk.kssk..', '...kGGk.kGGk..', '..kkkk..kkkk..'],
    pen_ball: ['..kkk..', '.kwkwk.', 'kwwkwwk', 'kkwwwkk', 'kwwkwwk', '.kwkwk.', '..kkk..'],
    /* Cowrie */
    cowrie: ['..........', '...kkkk...', '..kwwssk..', '.kwsssssk.', '.kssUUssk.', '.ksUwwUsk.', '.kssUUssk.', '.kSsssSsk.', '..kkkkkk..', '..........'],
    /* Page extras */
    heart: ['.rr.rr.', 'rwrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
    arrow: ['...k...', '..kyk..', '.kyyyk.', 'kyyyyyk', '..kyk..', '..kyk..', '..kkk..']
  }
};
