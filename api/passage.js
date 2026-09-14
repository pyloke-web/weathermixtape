// api/passage.js
// Vercel serverless function. Given ?mood=rainy etc, it:
// 1. picks a random classic novel from a curated pool of real Project Gutenberg IDs
// 2. downloads that book's full plain-text file server-side (no CORS issue here,
//    since this runs on the server, not in the browser)
// 3. searches for sentences containing weather words matching the mood
// 4. returns one at random, plus a link to read the full book

const KEYWORDS = {
  clear: ["sunshine", "sunny", "sunlit", "bright sun", "clear sky", "brilliant sunshine"],
  cloudy: ["cloud", "clouds", "overcast", "grey sky", "gloomy sky", "dull sky"],
  foggy: ["fog", "foggy", "mist", "misty", "haze"],
  rainy: ["rain", "raining", "drizzle", "downpour", "rainy"],
  snowy: ["snow", "snowing", "snowy", "frost", "blizzard"],
  stormy: ["storm", "thunder", "lightning", "tempest", "gale"],
  windy: ["wind", "windy", "breeze", "gust", "gale"]
};

// A pool of well-known public domain novels. IDs are Project Gutenberg ebook numbers.
// If any ID is wrong or moved, the function just skips it and tries another —
// but you can double check any ID at https://gutendex.com/books/<id>
const BOOKS = [
  { id: 1342, title: "Pride and Prejudice", author: "Jane Austen" },
  { id: 1260, title: "Jane Eyre", author: "Charlotte Brontë" },
  { id: 768, title: "Wuthering Heights", author: "Emily Brontë" },
  { id: 84, title: "Frankenstein", author: "Mary Shelley" },
  { id: 11, title: "Alice's Adventures in Wonderland", author: "Lewis Carroll" },
  { id: 2701, title: "Moby-Dick", author: "Herman Melville" },
  { id: 46, title: "A Christmas Carol", author: "Charles Dickens" },
  { id: 514, title: "Little Women", author: "Louisa May Alcott" },
  { id: 45, title: "Anne of Green Gables", author: "L. M. Montgomery" },
  { id: 205, title: "Walden", author: "Henry David Thoreau" },
  { id: 64317, title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
  { id: 345, title: "Dracula", author: "Bram Stoker" },
  { id: 1661, title: "The Adventures of Sherlock Holmes", author: "Arthur Conan Doyle" },
  { id: 161, title: "Sense and Sensibility", author: "Jane Austen" },
  { id: 113, title: "The Secret Garden", author: "Frances Hodgson Burnett" },
  { id: 158, title: "Emma", author: "Jane Austen" }
];

function stripBoilerplate(text) {
  const startMatch = text.match(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i);
  const endMatch = text.match(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i);
  const start = startMatch ? startMatch.index + startMatch[0].length : 0;
  const end = endMatch ? endMatch.index : text.length;
  return text.slice(start, end);
}

function findMatches(text, keywords) {
  const clean = text.replace(/\r\n/g, " ").replace(/\n/g, " ").replace(/\s+/g, " ");
  const sentences = clean.match(/[^.!?]+[.!?]/g) || [];
  const pattern = new RegExp("\\b(" + keywords.join("|") + ")\\b", "i");
  return sentences
    .map((s) => s.trim())
    .filter((s) => s.length > 40 && s.length < 280 && pattern.test(s));
}

export default async function handler(req, res) {
  const mood = String(req.query.mood || "clear").toLowerCase();
  const keywords = KEYWORDS[mood] || KEYWORDS.clear;

  // Try up to 6 random books until we find a matching sentence.
  const shuffled = [...BOOKS].sort(() => Math.random() - 0.5).slice(0, 6);

  for (const book of shuffled) {
    try {
      const url = `https://www.gutenberg.org/cache/epub/${book.id}/pg${book.id}.txt`;
      const r = await fetch(url);
      if (!r.ok) continue;
      const raw = await r.text();
      const body = stripBoilerplate(raw);
      const matches = findMatches(body, keywords);
      if (matches.length > 0) {
        const pick = matches[Math.floor(Math.random() * matches.length)];
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({
          text: pick,
          author: book.author,
          title: book.title,
          link: `https://www.gutenberg.org/ebooks/${book.id}`
        });
      }
    } catch (e) {
      continue;
    }
  }

  return res.status(404).json({ error: "Couldn't find a matching passage this time — try again." });
}
