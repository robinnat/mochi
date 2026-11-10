import type fr from './fr'

/**
 * The `typeof fr` type is the lock: a forgotten or misspelled key is a named compile error, not a missing string
 * found on screen.
 */
const en: typeof fr = {
  app: {
    name: 'mochis',
    title: 'Mochis, animated avatar',
    botAria: 'Animated mochi avatar',
    no3d: '3D needs WebGL'
  },

  gallery: {
    back: 'Back to the player'
  },

  rail: {
    nav: 'Sections',
    customize: 'Customize',
    animations: 'Animations',
    settings: 'Settings'
  },

  panel: {
    animations: 'Animation',
    shape: 'Shape',
    expression: 'Expression',
    color: 'Color',
    style: 'Style',
    pixelSize: 'Pixel size',
    outline: 'Cartoon outline'
  },

  export: {
    action: 'Export as PNG',
    more: 'Other formats',
    png: 'Download PNG',
    svg: 'Download SVG',
    gif: 'Download animated GIF',
    cycleDetail: 'The video is lighter and smoother; the GIF plays anywhere.',
    cycleFormat: 'Format',
    cycle_mp4: 'MP4 video',
    cycle_mp4_help: 'Light and smooth, needs a background',
    cycle_gif: 'Animated GIF',
    cycle_gif_help: 'Plays anywhere, heavier',
    cycleProgress: 'Exporting…',
    cycleRetry: 'Try again',
    gifTitle: 'Download animated GIF',
    gifDetail:
      'GIF transparency is all-or-nothing: with no background, the ball\u2019s edge comes out a little hard.',
    gifBackground: 'Background',
    background_white: 'White background',
    background_white_help: 'Smooth edge, for light surfaces',
    background_transparent: 'Transparent background',
    background_transparent_help: 'Fits any background, edge a little hard',
    gifConfirm: 'Download',
    copy: 'Copy image',
    copySvg: 'Copy SVG',
    done: 'Exported',
    copied: 'Copied',
    failed: 'Export failed'
  },

  preview: {
    exit: 'Exit preview',
    key: 'Esc'
  },

  timeline: {
    play: 'Start playback',
    pause: 'Stop playback',
    addAnimation: 'Add an animation',
    preview: 'Preview',
    export: 'Export the montage',
    zoom: 'Track zoom',
    blockAria: '{state}, {duration}',
    blockDurationAria: 'Duration of {state}, {duration}',
    blockRemoveAria: 'Remove {state}'
  },

  dialog: {
    cancel: 'Cancel',
    nameCreateTitle: 'New cycle',
    nameRenameTitle: 'Rename cycle',
    nameField: 'Cycle name',
    nameCreate: 'Create',
    nameRename: 'Rename',
    removeTitle: 'Delete "{name}"?',
    removeDetail:
      'This sequence will be lost, along with its animation. | This sequence will be lost, along with its {n} animations.',
    removeConfirm: 'Delete'
  },

  cycles: {
    defaultName: 'Default cycle',
    newName: 'My cycle',
    menuNew: 'New cycle',
    menuRenameAria: 'Rename {name}',
    menuRemoveAria: 'Delete {name}'
  },

  units: {
    seconds: '{n} s',
    secondsShort: '{n}s'
  },

  settings: {
    title: 'Settings',
    language: 'Language',
    github: 'View the project on GitHub',
    githubAria: 'The project repository on GitHub, in a new tab'
  },

  states: {
    idle: 'Idle',
    thinking: 'Thinking',
    wink: 'Wink',
    wide: 'Wide eyes',
    sleep: 'Sleep',
    swirl: 'Swirl'
  },

  styles: {
    '3d': 'Soft',
    flat3d: 'Flat',
    pixel3d: 'Pixel'
  },

  pixelSizes: {
    large: 'Large',
    medium: 'Medium',
    end: 'Fine'
  },

  shapes: {
    circle: 'Circle',
    pebble: 'Pebble',
    squircle: 'Squircle',
    capsule: 'Capsule',
    triangle: 'Triangle',
    hexagon: 'Hexagon',
    cloud: 'Cloud',
    drop: 'Droplet',
    star: 'Star',
    flower: 'Flower',
    egg: 'Egg',
    heart: 'Heart'
  },

  colors: {
    ink: 'Ink',
    cream: 'Cream',
    brown: 'Brown',
    red: 'Tomato',
    coral: 'Coral',
    orange: 'Orange',
    amber: 'Sunny yellow',
    lime: 'Lime',
    apple: 'Apple green',
    green: 'Emerald',
    turquoise: 'Turquoise',
    sky: 'Sky',
    blue: 'Royal blue',
    violet: 'Violet',
    magenta: 'Magenta',
    pink: 'Pink',
    cherry: 'Cherry',
    grey: 'Grey'
  },

  expressions: {
    neutral: 'Neutral',
    attentive: 'Attentive',
    surprised: 'Surprised',
    excited: 'Excited',
    happy: 'Happy',
    laughing: 'Laughing',
    angry: 'Angry',
    sad: 'Sad',
    scared: 'Scared',
    suspicious: 'Suspicious',
    confused: 'Confused',
    curious: 'Curious',
    proud: 'Proud',
    shy: 'Shy',
    unimpressed: 'Unimpressed',
    sleepy: 'Sleepy'
  }
}

export default en
