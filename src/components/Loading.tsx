import Spinner from 'react-bootstrap/Spinner';

interface LoadingProps {
  message?: string;
}

export default function Loading({ message = 'Carregando...' }: LoadingProps) {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center gap-3 py-5">
      <Spinner animation="border" variant="primary" role="status">
        <span className="visually-hidden">{message}</span>
      </Spinner>
      <p className="text-secondary mb-0">{message}</p>
    </div>
  );
}
