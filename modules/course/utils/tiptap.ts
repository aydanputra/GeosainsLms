
export const isTiptapDocEmpty = (doc: any): boolean => {
  if (!doc) return true;
  
  // If string (HTML), check if it has meaningful text
  if (typeof doc === 'string') {
    const text = doc.replace(/<[^>]*>/g, '').trim();
    // Also check for empty structure like <p></p>
    if (text.length === 0) {
        // But maybe it has image? <img src="..."> has no text.
        if (doc.includes('<img') || doc.includes('<iframe') || doc.includes('<hr')) return false;
        return true;
    }
    return false;
  }
  
  if (doc.type !== 'doc') return true;
  if (!Array.isArray(doc.content) || doc.content.length === 0) return true;

  // Check if content has only empty paragraphs
  // A paragraph is empty if it has no content or empty text
  const isEmptyNode = (node: any): boolean => {
    if (node.type === 'text') {
        return !node.text || node.text.trim().length === 0;
    }
    if (!node.content || node.content.length === 0) {
        // Nodes like 'image', 'horizontalRule' are not empty even if no content
        if (['image', 'horizontalRule', 'hardBreak'].includes(node.type)) return false;
        return true;
    }
    return node.content.every(isEmptyNode);
  };

  return doc.content.every(isEmptyNode);
};
