// CineMate helper utilities

export function generateRoomId(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const segment = (len: number) => {
    let result = '';
    for (let i = 0; i < len; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };
  return `${segment(3)}-${segment(3)}-${segment(3)}`;
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Extracts a local video thumbnail at ~2 seconds into the video using an in-memory video & canvas element
 */
export async function generateVideoThumbnail(file: File): Promise<{ thumbnailUrl: string; duration: number; resolution: string }> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const fileUrl = URL.createObjectURL(file);
    video.src = fileUrl;

    video.onloadedmetadata = () => {
      const duration = video.duration || 0;
      const resolution = `${video.videoWidth || 1920}x${video.videoHeight || 1080}`;
      
      // Seek to 2 seconds or 20% of duration
      const seekTime = Math.min(2.0, duration * 0.2);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(video.videoWidth || 640, 640);
        canvas.height = Math.round(canvas.width * ((video.videoHeight || 360) / (video.videoWidth || 640)));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.82);
          URL.revokeObjectURL(fileUrl);
          resolve({
            thumbnailUrl,
            duration: video.duration || 0,
            resolution: `${video.videoWidth || 1920}x${video.videoHeight || 1080}`
          });
          return;
        }
      } catch (e) {
        console.warn('Canvas thumbnail generation fallback', e);
      }
      URL.revokeObjectURL(fileUrl);
      resolve({
        thumbnailUrl: '',
        duration: video.duration || 0,
        resolution: `${video.videoWidth || 1920}x${video.videoHeight || 1080}`
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(fileUrl);
      resolve({ thumbnailUrl: '', duration: 0, resolution: '1080p' });
    };

    // Timeout safety
    setTimeout(() => {
      resolve({ thumbnailUrl: '', duration: video.duration || 0, resolution: '1080p' });
    }, 4000);
  });
}

export function getAvatarGradient(name: string): string {
  const gradients = [
    'from-purple-600 to-indigo-600',
    'from-pink-600 to-rose-600',
    'from-amber-500 to-orange-600',
    'from-emerald-500 to-teal-700',
    'from-cyan-500 to-blue-600',
    'from-fuchsia-600 to-pink-600',
    'from-violet-600 to-purple-800'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

export const INITIAL_WATCHLIST = [
  {
    id: 'w1',
    title: 'La La Land',
    description: 'A jazz pianist falls for an aspiring actress in Los Angeles.',
    genre: 'Romance / Musical',
    duration: '2h 08m',
    rating: 4.8,
    posterUrl: 'https://images.unsplash.com/photo-1518173946687-a4c8a383392e?auto=format&fit=crop&w=600&q=80',
    addedBy: 'Sarah',
    watched: false,
    notes: 'For our next nostalgic weekend vibe!'
  },
  {
    id: 'w2',
    title: 'Interstellar',
    description: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity survival.',
    genre: 'Sci-Fi / Adventure',
    duration: '2h 49m',
    rating: 4.9,
    posterUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80',
    addedBy: 'Alex',
    watched: true,
    notes: 'The Hans Zimmer soundtrack had us both crying.'
  },
  {
    id: 'w3',
    title: 'Spirited Away',
    description: 'A young girl wanders into a world ruled by gods, witches, and spirits.',
    genre: 'Animation / Fantasy',
    duration: '2h 05m',
    rating: 4.9,
    posterUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
    addedBy: 'Sarah',
    watched: false,
    notes: 'Cozy animated classic with hot chocolate.'
  },
  {
    id: 'w4',
    title: 'Before Sunrise',
    description: 'A young man and woman meet on a train in Europe, and wind up spending one evening together in Vienna.',
    genre: 'Romance / Drama',
    duration: '1h 41m',
    rating: 4.7,
    posterUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=600&q=80',
    addedBy: 'Alex',
    watched: false,
    notes: 'Perfect dialogue for late night watching.'
  }
];

