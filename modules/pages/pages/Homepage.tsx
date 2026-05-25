import PageRenderer from '../components/PageRenderer';

type PageBlock = { id: string; type: string; content: string };
type PageData = { blocks: PageBlock[] };

export default function Homepage({ page }: { page: PageData | null }) {
  return (
    <div>
      {page && <PageRenderer blocks={page.blocks} />}
    </div>
  );
}
