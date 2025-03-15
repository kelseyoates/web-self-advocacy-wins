import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import WinCard from '../components/WinCard';

const ViewWinScreen = ({ route }) => {
  const { winId } = route.params;
  const [win, setWin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWin = async () => {
      try {
        const winDoc = await getDoc(doc(db, 'wins', winId));
        if (winDoc.exists()) {
          setWin({ id: winDoc.id, ...winDoc.data() });
        }
      } catch (error) {
        console.error('Error fetching win:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWin();
  }, [winId]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#24269B" />
      </View>
    );
  }

  if (!win) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Win not found</Text>
      </View>
    );
  }

  return <WinCard win={win} />;
};

export default ViewWinScreen; 