export const site = {
  url: new URL(process.env.SITE_URL || 'https://nhacsong.vercel.app'),
  name: 'Âm Thanh Nhạc Sống Hồng Lâm',
  title: 'Âm Thanh Nhạc Sống Hồng Lâm – Tìm lời bài hát & Karaoke',
  description: 'Tìm lời bài hát tiếng Việt, trình chiếu lời chữ lớn và hát karaoke YouTube cùng Âm Thanh Nhạc Sống Hồng Lâm. Tìm nhanh bằng tên bài, ca sĩ hoặc giọng nói.',
};

export const indexable = !process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'production';
