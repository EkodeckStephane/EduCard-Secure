import { Component, ReactNode } from 'react';
import { Button, Paper, Typography } from '@mui/material';

export class GlobalErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="errorPage">
        <Paper className="panel">
          <Typography variant="h3">Erreur serveur</Typography>
          <Typography>{this.state.error.message}</Typography>
          <Button
            variant="contained"
            onClick={() => {
              this.setState({ error: null });
              window.location.href = '/dashboard';
            }}
          >
            Retour au tableau de bord
          </Button>
        </Paper>
      </main>
    );
  }
}
