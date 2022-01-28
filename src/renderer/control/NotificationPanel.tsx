import { Alert, Snackbar } from '@mui/material';
import { FC } from 'react';
import { useRecoilState } from 'recoil';
import { notificationAtom } from '../state/panelStateAtom';

export const NotificationPanel: FC = () => {
  const [message, setMessage] = useRecoilState(notificationAtom);

  const handleClose = () => {
    setMessage('');
  };

  return (
    <Snackbar
      open={!!message}
      autoHideDuration={6000}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      onClose={handleClose}
    >
      <Alert onClose={handleClose} severity="info">
        {message}
      </Alert>
    </Snackbar>
  );
};