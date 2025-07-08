import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './DrinkInventory.css'; // Optional for styles

interface Props {
  isAdmin: boolean;
  defaultStartDate?: string;
  defaultEndDate?: string;
}

interface Drink {
  id: string;
  title: string;
  price: number;
  quantity: number;
}

const DrinkInventory: React.FC<Props> = () => {
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${process.env.REACT_APP_BACKEND_URL}/v1/admin/drinks`)
      .then(res => {
        if (res.data.status) {
          setDrinks(res.data.data);
        }
      })
      .catch(err => {
        console.error('Error fetching drinks:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="inventory-container">
      <h2>Drink Inventory</h2>
      {loading ? (
        <p>Loading drinks...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Drink</th>
              <th>Price (₦)</th>
              <th>Stock Left</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {drinks.map(drink => (
              <tr key={drink.id}>
                <td>{drink.title}</td>
                <td>{drink.price}</td>
                <td>{drink.quantity}</td>
                <td>
                  {drink.quantity === 0 ? (
                    <span className="out-of-stock">Out of stock</span>
                  ) : drink.quantity <= 2 ? (
                    <span className="low-stock">Low</span>
                  ) : (
                    <span className="in-stock">Available</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default DrinkInventory;
