import type fr from './fr'

/**
 * Simplified Chinese. Three typographic differences carried by the translation and not by the code:
 *
 * - full width punctuation (， 。 ？ “ ”), templates included;
 * - no plural: `removeDetail` has a single form, and the classifier `个` is required before the counted noun;
 * - a thin space separates Latin digits from Chinese characters, except in the ruler ticks where room is short.
 */
const zh: typeof fr = {
  app: {
    name: 'mochis',
    title: 'Mochis, 动画头像',
    botAria: 'mochi 动画头像',
    no3d: '3D 需要 WebGL'
  },

  gallery: {
    back: '返回播放器'
  },

  rail: {
    nav: '版块',
    customize: '个性化',
    animations: '动画',
    settings: '设置'
  },

  panel: {
    animations: '动画',
    shape: '形状',
    expression: '表情',
    color: '颜色',
    style: '风格',
    pixelSize: '像素大小',
    outline: '卡通轮廓'
  },

  export: {
    action: '导出 PNG',
    more: '其他格式',
    png: '下载 PNG',
    svg: '下载 SVG',
    gif: '下载 GIF 动图',
    cycleDetail: '视频更轻更流畅；GIF 到处都能播放。',
    cycleFormat: '格式',
    cycle_mp4: 'MP4 视频',
    cycle_mp4_help: '轻巧流畅，必须有背景',
    cycle_gif: 'GIF 动图',
    cycle_gif_help: '到处可播，体积更大',
    cycleProgress: '正在导出…',
    cycleRetry: '重试',
    gifTitle: '下载 GIF 动图',
    gifDetail: 'GIF 的透明只有全有或全无：不加背景时，球体边缘会略显生硬。',
    gifBackground: '背景',
    background_white: '白色背景',
    background_white_help: '边缘平滑，适合浅色底',
    background_transparent: '透明背景',
    background_transparent_help: '适配任何背景，边缘略硬',
    gifConfirm: '下载',
    copy: '复制图片',
    copySvg: '复制 SVG',
    done: '已导出',
    copied: '已复制',
    failed: '导出失败'
  },

  preview: {
    exit: '退出预览',
    key: 'Esc'
  },

  timeline: {
    play: '开始播放',
    pause: '停止播放',
    addAnimation: '添加动画',
    preview: '预览',
    export: '导出动画序列',
    zoom: '轨道缩放',
    blockAria: '{state}，{duration}',
    blockDurationAria: '{state} 的时长，{duration}',
    blockRemoveAria: '移除 {state}'
  },

  dialog: {
    cancel: '取消',
    nameCreateTitle: '新建序列',
    nameRenameTitle: '重命名序列',
    nameField: '序列名称',
    nameCreate: '创建',
    nameRename: '重命名',
    removeTitle: '删除“{name}”？',
    removeDetail: '该序列将被删除，其中包含的 {n} 个动画也将一并丢失。',
    removeConfirm: '删除'
  },

  cycles: {
    defaultName: '默认序列',
    newName: '我的序列',
    menuNew: '新建序列',
    menuRenameAria: '重命名 {name}',
    menuRemoveAria: '删除 {name}'
  },

  units: {
    seconds: '{n} 秒',
    secondsShort: '{n}秒'
  },

  settings: {
    title: '设置',
    language: '语言',
    github: '在 GitHub 上查看项目',
    githubAria: '项目的 GitHub 仓库，在新标签页中打开'
  },

  states: {
    idle: '静止',
    thinking: '思考',
    wink: '眨眼',
    wide: '睁大眼睛',
    sleep: '休眠',
    swirl: '漩涡'
  },

  styles: {
    '3d': '柔和',
    flat3d: '扁平',
    pixel3d: '像素'
  },

  pixelSizes: {
    large: '大',
    medium: '中',
    end: '小'
  },

  shapes: {
    circle: '圆形',
    pebble: '卵石',
    squircle: '圆角方形',
    capsule: '胶囊',
    triangle: '三角形',
    hexagon: '六边形',
    cloud: '云朵',
    drop: '水滴',
    star: '星星',
    flower: '花朵',
    egg: '鸡蛋',
    heart: '爱心'
  },

  colors: {
    ink: '墨黑',
    cream: '奶油白',
    brown: '棕色',
    red: '番茄红',
    coral: '珊瑚色',
    orange: '橙色',
    amber: '亮黄色',
    lime: '青柠绿',
    apple: '苹果绿',
    green: '翡翠绿',
    turquoise: '青绿色',
    sky: '天蓝色',
    blue: '宝蓝色',
    violet: '紫色',
    magenta: '洋红色',
    pink: '粉色',
    cherry: '樱桃红',
    gray: '灰色'
  },

  expressions: {
    neutral: '平静',
    attentive: '专注',
    surprised: '惊讶',
    excited: '兴奋',
    happy: '开心',
    laughing: '大笑',
    angry: '生气',
    sad: '难过',
    scared: '害怕',
    suspicious: '怀疑',
    confused: '困惑',
    curious: '好奇',
    proud: '得意',
    shy: '羞怯',
    unimpressed: '无趣',
    sleepy: '困倦'
  }
}

export default zh
