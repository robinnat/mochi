/**
 * Video encoding of the animation, as MP4.
 *
 * The only module of the project that depends on an external library, and it does so through a DYNAMIC import:
 * mediabunny weighs 43 kB gzip as a static import, more than the 34 kB that ruled out an i18n library in favor of an
 * in-house layer. Loaded on demand, it only costs 0.7 kB when the site loads and only arrives the day someone exports
 * a video.
 *
 * Writing the container by hand as for GIF and WebP was not workable here: an MP4 needs the whole ISO BMFF box tree
 * and its sample tables, while a GIF fits in a few hundred lines.
 *
 * The video is necessarily OPAQUE. Checked on the spot: `VideoEncoder` refuses `alpha: 'keep'`, in H.264 as in VP9.
 * That is why the video export forces a background, while the GIF leaves the choice.
 */

import { stops } from './export'

/**
 * Explicit QUANTIZER, not a `QUALITY_*` level.
 *
 * Not a tuning detail, it is the key to quality here. mediabunny's named levels do NOT set a bitrate: when the
 * browser can encode at a fixed quantizer (Chrome 117 and later for all these codecs) they become `bitrateMode:
 * 'quantizer'` and the computed bitrate only picks the AVC level of the codec string. `QUALITY_HIGH` set a QP of 22,
 * and raising a bitrate would have changed nothing.
 *
 * Measured on a frame of the bot, edge error against the source: QP 22 -> 3.06 · QP 16 -> 1.75 · QP 10 -> 0.58. We
 * take 12, almost transparent, for about 50 % more bytes than at 22: an offline export has no size constraint, and
 * the edge of the shapes is what gives the clean impression.
 *
 * The bitrate goes with the quantizer as a FALLBACK: if a browser cannot encode at a fixed quantizer, mediabunny
 * switches to it instead of failing. Six megabits for 1024 at 30 fps is generous on flat colors.
 */
const QP = 12
const BITRATE_FALLBACK = 6_000_000

/**
 * Encodes a series of frames into MP4.
 *
 * `renders` draws frame `i` INTO the given canvas, then hands back. Frames are never accumulated: each is encoded and
 * dropped before the next, otherwise a thirty-second cycle would hold 255 MB of raw pixels in memory.
 */
export async function toMp4(
  canvas: HTMLCanvasElement,
  images: number,
  fps: number,
  renders: (index: number) => void | Promise<void>,
  advance?: (done: number, total: number) => void,
  /** Abandon demande par l'utilisateur. Cf. `stops` ci-dessous. */
  signal?: AbortSignal
): Promise<Blob> {
  const { BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality } = await import(
    'mediabunny'
  )

  const exit = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })
  const source = new CanvasSource(canvas, {
    codec: 'avc',
    quality: new Quality({ quantizer: QP, bitrate: BITRATE_FALLBACK })
  })
  exit.addVideoTrack(source, { frameRate: fps })
  await exit.start()

  /*
   * From here the encoder is OPEN, so every exit path must go through `cancel`. Without it, a frame that failed to
   * render left the `VideoEncoder` behind: Chrome caps the number of simultaneous hardware encoders, so after a few
   * failures the next exports failed at `start()` for a reason that had nothing to do with the real cause. The
   * off-screen player of `capture.ts` is closed in a `finally` for the same reason; the encoder had no equivalent.
   */
  try {
    const duration = 1 / fps
    for (let i = 0; i < images; i++) {
      stops(signal)
      await renders(i)
      // `await` on each frame and not in a batch: that applies the
      // encoder's back-pressure, and so bounds memory.
      await source.add(i * duration, duration)
      advance?.(i + 1, images)
    }
    stops(signal)

    await exit.finalize()
    const buffer = exit.target.buffer
    if (!buffer) throw new Error('encodage mp4 vide')
    return new Blob([buffer], { type: 'video/mp4' })
  } catch (e) {
    await exit.cancel()
    throw e
  }
}
