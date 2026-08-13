export interface Station {
  id: number;
  name: string;
  /** Kullanıcının yazabileceği alternatif adlar. */
  aliases: string[];
}

/**
 * Sık kullanılan TCDD istasyonları.
 * Yeni istasyon eklemek için buraya bir satır eklemek yeterlidir.
 */
export const STATIONS: Station[] = [
  { id: 98, name: 'ANKARA GAR', aliases: ['ankara', 'ank'] },
  { id: 1323, name: 'İSTANBUL(BOSTANCI)', aliases: ['istanbul', 'bostanci', 'ist'] },
  { id: 1324, name: 'SÖĞÜTLÜÇEŞME', aliases: ['sogutlucesme', 'sogutlu'] },
  { id: 48, name: 'İSTANBUL(PENDİK)', aliases: ['pendik'] },
  { id: 1135, name: 'ESKİŞEHİR', aliases: ['eskisehir', 'esk'] },
  { id: 172, name: 'KONYA', aliases: ['konya'] },
  { id: 1327, name: 'İZMİT(YARIMCA)', aliases: ['izmit', 'yarimca', 'kocaeli'] },
  { id: 175, name: 'SİVAS', aliases: ['sivas'] },
  { id: 1332, name: 'KAYSERİ', aliases: ['kayseri'] },
  { id: 987, name: 'BURSA', aliases: ['bursa'] },
  { id: 1326, name: 'GEBZE', aliases: ['gebze'] },
  { id: 1129, name: 'AFYONKARAHİSAR', aliases: ['afyon', 'afyonkarahisar'] },
  { id: 1131, name: 'DENİZLİ', aliases: ['denizli'] },
  { id: 93, name: 'ADANA', aliases: ['adana'] },
  { id: 1134, name: 'MALATYA', aliases: ['malatya'] },
  { id: 1136, name: 'DİYARBAKIR', aliases: ['diyarbakir'] }
];

/**
 * Türkçe karakterleri ve büyük/küçük harf farklarını yok sayarak
 * arama yapılabilir bir biçime çevirir.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Kullanıcının yazdığı metne karşılık gelen istasyonu bulur.
 * Önce tam eşleşme, sonra kısmi eşleşme denenir.
 */
export function findStation(input: string): Station | null {
  const query = normalize(input);
  if (!query) return null;

  const candidates = STATIONS.map(station => ({
    station,
    keys: [normalize(station.name), ...station.aliases.map(normalize)]
  }));

  const exact = candidates.find(c => c.keys.some(key => key === query));
  if (exact) return exact.station;

  const partial = candidates.filter(c => c.keys.some(key => key.startsWith(query) || key.includes(query)));

  // Birden fazla istasyona uyuyorsa belirsizdir, seçim yapma.
  return partial.length === 1 ? partial[0].station : null;
}

/** Kullanıcıya gösterilecek istasyon listesi. */
export function formatStationList(): string {
  return STATIONS.map(s => `• ${s.name}`).join('\n');
}
