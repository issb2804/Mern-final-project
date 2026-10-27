import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <div className="card">
      <EmptyState
        icon={Compass}
        title="Page not found"
        action={
          <Link to="/" className="btn-primary">
            Go to today
          </Link>
        }
      >
        That page doesn't exist.
      </EmptyState>
    </div>
  );
}
