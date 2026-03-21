import cors from 'cors'
import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'

const app = express()
const PORT = Number(process.env.PORT || 4174)

// Update this path to your albums root folder.
// Example structure:
// D:\Music\Albums\Album Title - Album Artist\01 - Artist - Song.mp3
const ALBUMS_ROOT = process.env.ALBUMS_ROOT || String.raw`D:\Music\Albums`

const AUDIO_EXT_RE = /\.(mp3|m4a|aac|wav|flac|ogg|opus|wma)$/i
const COVER_RE = /^cover\.(jpg|jpeg|png|webp)$/i
const PLAYLIST_EXT_RE = /\.(m3u|m3u8)$/i
const LRC_EXT_RE = /\.lrc$/i

let cachedLibrary = {
  rootPath: ALBUMS_ROOT,
  scannedAt: null,
  tracks: [],
}

app.use(cors())

function toPosix(filePath) {
  return filePath.split(path.sep).join('/')
}

function stripExtension(filename) {
  return String(filename || '').replace(/\.[^/.]+$/, '')
}

function parseAlbumFolderName(folderName) {
  const fallback = {
    albumTitle: folderName || 'Unknown Album',
    albumArtist: 'Unknown Artist',
  }

  if (!folderName || !folderName.includes(' - ')) {
    return fallback
  }

  const parts = folderName.split(' - ').map(p => p.trim()).filter(Boolean)
  if (parts.length < 2) {
    return fallback
  }

  return {
    albumTitle: parts.slice(0, -1).join(' - '),
    albumArtist: parts[parts.length - 1],
  }
}

function parseTrackFileName(filename) {
  const base = stripExtension(filename)
  const match = base.match(/^(\d+)\s*-\s*(.+?)\s*-\s*(.+)$/)

  if (match) {
    return {
      trackNumber: Number.parseInt(match[1], 10),
      artist: match[2].trim(),
      title: match[3].trim(),
    }
  }

  return {
    trackNumber: Number.MAX_SAFE_INTEGER,
    artist: 'Unknown Artist',
    title: base,
  }
}

function parseLrcText(text) {
  const rows = []
  const lines = String(text || '').split(/\r?\n/)

  for (const line of lines) {
    const timestamps = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)]
    if (!timestamps.length) continue

    const lyricText = line.replace(/\[[^\]]+\]/g, '').trim()

    for (const stamp of timestamps) {
      const min = Number.parseInt(stamp[1], 10)
      const sec = Number.parseInt(stamp[2], 10)
      const fractionRaw = stamp[3] ?? '0'
      const fraction = Number.parseInt(fractionRaw.padEnd(3, '0').slice(0, 3), 10)
      const time = min * 60 + sec + fraction / 1000

      rows.push({ time, text: lyricText || '...' })
    }
  }

  rows.sort((a, b) => a.time - b.time)
  return rows
}

function parseM3uOrder(content) {
  const orderMap = new Map()
  const lines = String(content || '').split(/\r?\n/)

  for (const raw of lines) {
    const line = raw.trim().replace(/^['"]|['"]$/g, '')
    if (!line || line.startsWith('#')) continue
    const parts = line.split(/[\\/]/)
    const base = (parts[parts.length - 1] || '').toLowerCase()
    if (!base) continue
    if (!orderMap.has(base)) {
      orderMap.set(base, orderMap.size)
    }
  }

  return orderMap
}

function safeResolveMediaPath(relativePath) {
  const decoded = decodeURIComponent(relativePath || '')
  const abs = path.resolve(ALBUMS_ROOT, decoded)
  const root = path.resolve(ALBUMS_ROOT)

  if (!abs.startsWith(root)) {
    throw new Error('Invalid path')
  }

  return abs
}

async function scanLibrary() {
  const rootStats = await fs.stat(ALBUMS_ROOT)
  if (!rootStats.isDirectory()) {
    throw new Error(`ALBUMS_ROOT is not a directory: ${ALBUMS_ROOT}`)
  }

  const rootEntries = await fs.readdir(ALBUMS_ROOT, { withFileTypes: true })
  const albumDirs = rootEntries.filter(e => e.isDirectory())

  const tracks = []

  for (const dir of albumDirs) {
    const albumFolderName = dir.name
    const albumAbsPath = path.join(ALBUMS_ROOT, albumFolderName)

    let jsonMeta = null
    try {
      const jsonText = await fs.readFile(path.join(albumAbsPath, `${albumFolderName}.json`), 'utf8')
      jsonMeta = JSON.parse(jsonText)
    } catch {
      // ignore
    }

    const fallbackMeta = parseAlbumFolderName(albumFolderName)
    const albumTitle = jsonMeta?.playlist?.title || fallbackMeta.albumTitle
    const albumArtist = jsonMeta?.playlist?.artist?.name || fallbackMeta.albumArtist

    const allFiles = []
    async function walk(currentDir) {
      const entries = await fs.readdir(currentDir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)
        if (entry.isDirectory()) {
          await walk(fullPath)
        } else {
          allFiles.push({
            name: entry.name,
            fullPath,
            dirName: path.basename(currentDir),
          })
        }
      }
    }
    await walk(albumAbsPath)

    let coverRelativePath = null
    let playlistOrderMap = new Map()
    const lyricsByBase = new Map()

    for (const file of allFiles) {
      const lower = file.name.toLowerCase()
      const rel = toPosix(path.relative(ALBUMS_ROOT, file.fullPath))

      if (COVER_RE.test(file.name)) {
        if (!coverRelativePath) coverRelativePath = rel
        continue
      }
      if (PLAYLIST_EXT_RE.test(lower)) {
        try {
          const m3uText = await fs.readFile(file.fullPath, 'utf8')
          const parsed = parseM3uOrder(m3uText)
          if (parsed.size > 0) playlistOrderMap = parsed
        } catch {}
        continue
      }
      if (LRC_EXT_RE.test(lower)) {
        try {
          const lrcText = await fs.readFile(file.fullPath, 'utf8')
          lyricsByBase.set(stripExtension(file.name).toLowerCase(), parseLrcText(lrcText))
        } catch {}
      }
    }

    const audioFiles = allFiles.filter(f => AUDIO_EXT_RE.test(f.name))

    const parsedAlbumTracks = audioFiles.map((file) => {
      const fileName = file.name
      const relativePath = toPosix(path.relative(ALBUMS_ROOT, file.fullPath))
      const basenm = stripExtension(fileName)

      let discNumber = 1
      const discMatch = file.dirName.match(/Disc\s*(\d+)/i)
      if (discMatch) {
        discNumber = Number.parseInt(discMatch[1], 10)
      }

      let jsonTrack = null
      if (jsonMeta && Array.isArray(jsonMeta.tracks)) {
        const match = basenm.match(/^(\d+)/)
        if (match) {
          const pos = Number.parseInt(match[1], 10)
          jsonTrack = jsonMeta.tracks.find(t => t.position === pos || t.trackNumber === pos)
        }
      }

      const trackMeta = parseTrackFileName(fileName)
      const playlistOrder = playlistOrderMap.get(fileName.toLowerCase())

      const finalArtist = jsonTrack?.artist || trackMeta.artist || albumArtist
      const finalTitle = jsonTrack?.title || trackMeta.title

      return {
        id: relativePath,
        album: albumTitle,
        albumArtist: albumArtist,
        artist: finalArtist,
        title: finalTitle,
        filename: fileName,
        relativePath,
        discNumber,
        trackNumber: jsonTrack?.trackNumber ?? (Number.isFinite(trackMeta.trackNumber) ? trackMeta.trackNumber : Number.MAX_SAFE_INTEGER),
        coverUrl: coverRelativePath ? `/media/${coverRelativePath.split('/').map(encodeURIComponent).join('/')}` : null,
        lyrics: lyricsByBase.get(basenm.toLowerCase()) || [],
        orderKey: Number.isFinite(playlistOrder) ? playlistOrder : (jsonTrack?.position ?? (Number.isFinite(trackMeta.trackNumber) ? trackMeta.trackNumber : Number.MAX_SAFE_INTEGER)),
        duration: jsonTrack?.duration || undefined,
      }
    })

    parsedAlbumTracks.sort((a, b) => {
      if (a.discNumber !== b.discNumber) return a.discNumber - b.discNumber
      if (a.orderKey !== b.orderKey) return a.orderKey - b.orderKey
      return a.filename.localeCompare(b.filename)
    })

    for (const t of parsedAlbumTracks) {
      tracks.push({
        ...t,
        url: `/media/${t.relativePath.split('/').map(encodeURIComponent).join('/')}`,
      })
    }
  }

  tracks.sort((a, b) => {
    const artistCmp = a.albumArtist.localeCompare(b.albumArtist)
    if (artistCmp !== 0) return artistCmp

    const albumCmp = a.album.localeCompare(b.album)
    if (albumCmp !== 0) return albumCmp

    if (a.discNumber !== b.discNumber) return a.discNumber - b.discNumber
    if (a.orderKey !== b.orderKey) return a.orderKey - b.orderKey

    return a.filename.localeCompare(b.filename)
  })

  cachedLibrary = {
    rootPath: ALBUMS_ROOT,
    scannedAt: new Date().toISOString(),
    tracks,
  }
}

app.get('/api/library', async (_req, res) => {
  try {
    if (!cachedLibrary.scannedAt) {
      await scanLibrary()
    }
    res.json(cachedLibrary)
  } catch (error) {
    res.status(500).json({
      error: 'Failed to scan library',
      detail: String(error?.message || error),
    })
  }
})

app.post('/api/library/refresh', async (_req, res) => {
  try {
    await scanLibrary()
    res.json(cachedLibrary)
  } catch (error) {
    res.status(500).json({
      error: 'Failed to refresh library',
      detail: String(error?.message || error),
    })
  }
})

app.get('/media/*', async (req, res) => {
  try {
    const relativePath = req.params[0]
    const filePath = safeResolveMediaPath(relativePath)
    res.sendFile(filePath)
  } catch {
    res.status(404).json({ error: 'Media file not found' })
  }
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rootPath: ALBUMS_ROOT })
})

app.listen(PORT, () => {
  console.log(`[library-server] http://localhost:${PORT}`)
  console.log(`[library-server] ALBUMS_ROOT=${ALBUMS_ROOT}`)
})
