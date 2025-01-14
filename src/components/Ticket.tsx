import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
} from '@mui/material';
import { useCallback } from 'react';

const Ticket = ({ transactionId }: { transactionId: number }) => {
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch ticket details from the backend
  const fetchTicket = useCallback(async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/v1/transaction/${transactionId}`);
      setTicket(response.data);
    } catch (error) {
      console.error('Error fetching ticket data:', error);
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  // Print ticket
  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <Container>
        <Typography variant="h6" align="center">
          Loading ticket details...
        </Typography>
      </Container>
    );
  }

  if (!ticket) {
    return (
      <Container>
        <Typography variant="h6" align="center">
          Ticket not found.
        </Typography>
      </Container>
    );
  }

  return (
    <Container>
      <Typography variant="h4" align="center" gutterBottom>
        Immersia Game Center
      </Typography>
      <Typography variant="h6" align="center" gutterBottom>
        Ticket Number: {transactionId}
      </Typography>
      <Typography variant="subtitle1" align="center" gutterBottom>
        Date: {new Date(ticket.createdAt).toLocaleDateString()} | Time: {new Date(ticket.createdAt).toLocaleTimeString()}
      </Typography>

      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Game</TableCell>
            <TableCell>Quantity</TableCell>
            <TableCell>Start Time</TableCell>
            <TableCell>End Time</TableCell>
            <TableCell>Amount Paid</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ticket.games.map((game: any, index: number) => (
            <TableRow key={index}>
              <TableCell>{game.title}</TableCell>
              <TableCell>{game.quantity}</TableCell>
              <TableCell>{new Date(game.startTime).toLocaleTimeString()}</TableCell>
              <TableCell>{new Date(game.endTime).toLocaleTimeString()}</TableCell>
              <TableCell>${game.amountPaid.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Button variant="contained" color="primary" onClick={handlePrint} style={{ marginTop: '20px' }}>
        Print Ticket
      </Button>
    </Container>
  );
};

export default Ticket;

