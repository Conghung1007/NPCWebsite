/** Detect TipTap / HTML article body vs legacy markdown */
export function isHtmlContent(content: string): boolean {
  const t = content.trimStart();
  return /^<(p|h[1-6]|ul|ol|figure|blockquote|hr|div|img|strong|em|a|br)[\s>/]/i.test(
    t,
  );
}

/** Convert simple markdown (legacy articles) to HTML for TipTap / display */
export function markdownToHtml(md: string): string {
  return md
    .split("\n")
    .map((line) => {
      if (/^### /.test(line)) return `<h3>${line.substring(4)}</h3>`;
      if (/^## /.test(line)) return `<h2>${line.substring(3)}</h2>`;
      if (/^# /.test(line)) return `<h1>${line.substring(2)}</h1>`;
      if (line.trim() === "---") return "<hr>";
      const imgMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      if (imgMatch) {
        return `<img src="${imgMatch[2]}" alt="${imgMatch[1] || ""}" />`;
      }
      let html = line
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(
          /\[([^\]]+)\]\(([^)]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
        );
      if (html.startsWith("- ")) return `<ul><li>${html.substring(2)}</li></ul>`;
      if (/^\d+\.\s/.test(html)) {
        return `<ol><li>${html.replace(/^\d+\.\s/, "")}</li></ol>`;
      }
      return html.trim() ? `<p>${html}</p>` : "";
    })
    .join("\n");
}

/** First cover image from imageUrl field or embedded content */
export function getArticleCoverUrl(article: {
  imageUrl?: string | null;
  content: string;
}): string | null {
  if (article.imageUrl?.trim()) return article.imageUrl.trim();

  const htmlImg = article.content.match(
    /<img[^>]+src=["']([^"']+)["']/i,
  );
  if (htmlImg?.[1]) return htmlImg[1];

  const mdImg = article.content.match(/!\[[^\]]*\]\(([^)]+)\)/);
  if (mdImg?.[1]) return mdImg[1];

  return null;
}

/** Plain-text preview for cards (strips HTML + markdown noise) */
export function getArticlePlainPreview(content: string, maxLen = 160): string {
  const text = content
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_`>\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trim()}…`;
}

/** Normalize content to HTML for safe rendering */
export function articleContentToHtml(content: string): string {
  if (!content?.trim()) return "";
  return isHtmlContent(content) ? content : markdownToHtml(content);
}
