import { useFlashcards } from '../hooks/useFlashcards';
import FlashcardDeck from '../components/FlashcardDeck';
import { PageLoader } from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

export default function FlashcardDeckWrapper({ resourceId }: { resourceId: string }) {
  const { flashcards, loading, error } = useFlashcards(resourceId);

  if (loading) return <PageLoader />;
  if (error) return <div className="text-red-500 text-center py-10">{error}</div>;

  if (!flashcards.length) {
    return (
      <EmptyState
        icon="📇"
        title="Deck is empty"
        description="The teacher hasn't added any cards to this deck yet."
      />
    );
  }

  return <FlashcardDeck flashcards={flashcards} />;
}
