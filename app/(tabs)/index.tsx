import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

interface Timer {
  id: string;
  name: string;
  duration: number;
  count: number;
  alarmType: 'bell' | 'chime' | 'beep' | 'silent';
}

export default function HomeScreen() {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTimer, setEditingTimer] = useState<Timer | null>(null);
  const [newTimerName, setNewTimerName] = useState('');
  const [newTimerMinutes, setNewTimerMinutes] = useState('');
  const [newTimerAlarm, setNewTimerAlarm] = useState<'bell' | 'chime' | 'beep' | 'silent'>('bell');
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    loadTimers();
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    if (activeTimer && remainingTime > 0) {
      const interval = setInterval(() => {
        setRemainingTime(prev => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeTimer, remainingTime]);

  const loadTimers = async () => {
    try {
      const saved = await AsyncStorage.getItem('timers');
      if (saved) {
        setTimers(JSON.parse(saved));
      }
    } catch (error) {
      console.error('データ読み込みエラー:', error);
    }
  };

  const saveTimers = async (newTimers: Timer[]) => {
    try {
      await AsyncStorage.setItem('timers', JSON.stringify(newTimers));
      setTimers(newTimers);
    } catch (error) {
      console.error('データ保存エラー:', error);
    }
  };

  const playAlarm = async (alarmType: 'bell' | 'chime' | 'beep' | 'silent') => {
    if (alarmType === 'silent') {
      return;
    }

    try {
      if (Platform.OS === 'web') {
        const audio = new Audio();
        const baseUrl = window.location.origin;
        switch (alarmType) {
          case 'bell':
            audio.src = `${baseUrl}/_expo/static/media/assets/sounds/bell.mp3`;
            break;
          case 'chime':
            audio.src = `${baseUrl}/_expo/static/media/assets/sounds/chime.mp3`;
            break;
          case 'beep':
            audio.src = `${baseUrl}/_expo/static/media/assets/sounds/beep.mp3`;
            break;
        }
        audio.play().catch(err => console.error('音声再生エラー:', err));
      } else {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
        });

        let soundFile;
        switch (alarmType) {
          case 'bell':
            soundFile = require('@/assets/sounds/bell.mp3');
            break;
          case 'chime':
            soundFile = require('@/assets/sounds/chime.mp3');
            break;
          case 'beep':
            soundFile = require('@/assets/sounds/beep.mp3');
            break;
        }

        const { sound: newSound } = await Audio.Sound.createAsync(soundFile);
        setSound(newSound);

        await newSound.playAsync();

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            newSound.unloadAsync();
          }
        });
      }
    } catch (error) {
      console.error('音声再生エラー:', error);
    }
  };

  const addTimer = () => {
    const minutes = parseFloat(newTimerMinutes);
    if (!newTimerName || isNaN(minutes) || minutes <= 0) {
      if (Platform.OS === 'web') {
        alert('名前と時間（分）を正しく入力してください');
      } else {
        Alert.alert('エラー', '名前と時間（分）を正しく入力してください');
      }
      return;
    }

    const newTimer: Timer = {
      id: Date.now().toString(),
      name: newTimerName,
      duration: minutes * 60,
      count: 0,
      alarmType: newTimerAlarm,
    };

    saveTimers([...timers, newTimer]);
    setNewTimerName('');
    setNewTimerMinutes('');
    setNewTimerAlarm('bell');
    setShowAddForm(false);
  };

  const startEdit = (timer: Timer) => {
    setEditingTimer(timer);
    setNewTimerName(timer.name);
    setNewTimerMinutes((timer.duration / 60).toString());
    setNewTimerAlarm(timer.alarmType);
  };

  const saveEdit = () => {
    if (!editingTimer) return;

    const minutes = parseFloat(newTimerMinutes);
    if (!newTimerName || isNaN(minutes) || minutes <= 0) {
      if (Platform.OS === 'web') {
        alert('名前と時間（分）を正しく入力してください');
      } else {
        Alert.alert('エラー', '名前と時間（分）を正しく入力してください');
      }
      return;
    }

    const updatedTimers = timers.map(t =>
      t.id === editingTimer.id
        ? { ...t, name: newTimerName, duration: minutes * 60, alarmType: newTimerAlarm }
        : t
    );

    saveTimers(updatedTimers);
    setEditingTimer(null);
    setNewTimerName('');
    setNewTimerMinutes('');
    setNewTimerAlarm('bell');
  };

  const cancelEdit = () => {
    setEditingTimer(null);
    setNewTimerName('');
    setNewTimerMinutes('');
    setNewTimerAlarm('bell');
  };

  const deleteTimer = (id: string) => {
    if (Platform.OS === 'web') {
      if (confirm('本当に削除しますか？')) {
        saveTimers(timers.filter(t => t.id !== id));
      }
    } else {
      Alert.alert('確認', '本当に削除しますか？', [
        { text: 'キャンセル' },
        { text: '削除', onPress: () => saveTimers(timers.filter(t => t.id !== id)) },
      ]);
    }
  };

  const startTimer = (timer: Timer) => {
    if (activeTimer) {
      if (Platform.OS === 'web') {
        alert('他のタイマーが実行中です');
      } else {
        Alert.alert('お知らせ', '他のタイマーが実行中です');
      }
      return;
    }
    setActiveTimer(timer.id);
    setRemainingTime(timer.duration);
  };

  const stopTimer = () => {
    setActiveTimer(null);
    setRemainingTime(0);
  };

  const handleTimerComplete = async () => {
    const timer = timers.find(t => t.id === activeTimer);
    
    if (timer) {
      await playAlarm(timer.alarmType);
    }
    
    const updatedTimers = timers.map(t => 
      t.id === activeTimer ? { ...t, count: t.count + 1 } : t
    );
    saveTimers(updatedTimers);
    
    setActiveTimer(null);
    setRemainingTime(0);
    
    setTimeout(() => {
      if (Platform.OS === 'web') {
        alert('完了！タイマーが終了しました！');
      } else {
        Alert.alert('完了！', 'タイマーが終了しました！');
      }
    }, 100);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTotalTime = () => {
    return timers.reduce((sum, t) => sum + (t.duration * t.count), 0);
  };

  const getAlarmLabel = (alarmType: string) => {
    switch (alarmType) {
      case 'bell': return '🔔 ベル';
      case 'chime': return '🎵 チャイム';
      case 'beep': return '📢 ビープ';
      case 'silent': return '📳 バイブ';
      default: return '🔔 ベル';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>習慣タイマー</Text>
      
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          今日の合計: {formatTime(getTotalTime())}
        </Text>
      </View>

      <ScrollView style={styles.timerList}>
        {timers.map(timer => (
          <View key={timer.id} style={styles.timerItem}>
            <View style={styles.timerInfo}>
              <Text style={styles.timerName}>{timer.name}</Text>
              <Text style={styles.timerDuration}>
                {formatTime(timer.duration)} | 実行: {timer.count}回 | {getAlarmLabel(timer.alarmType)}
              </Text>
            </View>
            
            {activeTimer === timer.id ? (
              <View style={styles.timerButtons}>
                <Text style={styles.remainingTime}>{formatTime(remainingTime)}</Text>
                <TouchableOpacity style={styles.stopButton} onPress={stopTimer}>
                  <Text style={styles.buttonText}>中止</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.timerButtons}>
                <TouchableOpacity 
                  style={styles.startButton} 
                  onPress={() => startTimer(timer)}
                  disabled={!!activeTimer}
                >
                  <Text style={styles.buttonText}>開始</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.editButton} 
                  onPress={() => startEdit(timer)}
                >
                  <Text style={styles.buttonText}>編集</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.deleteButton} 
                  onPress={() => deleteTimer(timer.id)}
                >
                  <Text style={styles.buttonText}>削除</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {editingTimer ? (
        <View style={styles.addForm}>
          <Text style={styles.formTitle}>タイマーを編集</Text>
          <TextInput
            style={styles.input}
            placeholder="タイマー名（例：読書）"
            value={newTimerName}
            onChangeText={setNewTimerName}
          />
          <TextInput
            style={styles.input}
            placeholder="時間（分）"
            value={newTimerMinutes}
            onChangeText={setNewTimerMinutes}
            keyboardType="numeric"
          />
          
          <Text style={styles.alarmLabel}>アラーム音:</Text>
          <View style={styles.alarmOptions}>
            {(['bell', 'chime', 'beep', 'silent'] as const).map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.alarmOption,
                  newTimerAlarm === type && styles.alarmOptionSelected
                ]}
                onPress={() => setNewTimerAlarm(type)}
              >
                <Text style={[
                  styles.alarmOptionText,
                  newTimerAlarm === type && styles.alarmOptionTextSelected
                ]}>
                  {getAlarmLabel(type)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.formButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={cancelEdit}>
              <Text style={styles.buttonText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={saveEdit}>
              <Text style={styles.buttonText}>保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : !showAddForm ? (
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddForm(true)}>
          <Text style={styles.addButtonText}>+ 新しいタイマーを追加</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.addForm}>
          <Text style={styles.formTitle}>新しいタイマーを追加</Text>
          <TextInput
            style={styles.input}
            placeholder="タイマー名（例：読書）"
            value={newTimerName}
            onChangeText={setNewTimerName}
          />
          <TextInput
            style={styles.input}
            placeholder="時間（分）"
            value={newTimerMinutes}
            onChangeText={setNewTimerMinutes}
            keyboardType="numeric"
          />
          
          <Text style={styles.alarmLabel}>アラーム音:</Text>
          <View style={styles.alarmOptions}>
            {(['bell', 'chime', 'beep', 'silent'] as const).map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.alarmOption,
                  newTimerAlarm === type && styles.alarmOptionSelected
                ]}
                onPress={() => setNewTimerAlarm(type)}
              >
                <Text style={[
                  styles.alarmOptionText,
                  newTimerAlarm === type && styles.alarmOptionTextSelected
                ]}>
                  {getAlarmLabel(type)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.formButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddForm(false)}>
              <Text style={styles.buttonText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={addTimer}>
              <Text style={styles.buttonText}>追加</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    marginTop: 40,
  },
  statsContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  statsText: {
    fontSize: 18,
    color: '#666',
  },
  timerList: {
    flex: 1,
  },
  timerItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timerInfo: {
    flex: 1,
  },
  timerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  timerDuration: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  timerButtons: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  remainingTime: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginRight: 10,
  },
  startButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
  },
  stopButton: {
    backgroundColor: '#f44336',
    padding: 10,
    borderRadius: 5,
  },
  editButton: {
    backgroundColor: '#2196F3',
    padding: 10,
    borderRadius: 5,
  },
  deleteButton: {
    backgroundColor: '#ff9800',
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addForm: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
    fontSize: 16,
  },
  alarmLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  alarmOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 15,
  },
  alarmOption: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  alarmOptionSelected: {
    backgroundColor: '#4CAF50',
  },
  alarmOptionText: {
    fontSize: 14,
    color: '#666',
  },
  alarmOptionTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  formButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#999',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
});