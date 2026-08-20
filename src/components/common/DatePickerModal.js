import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const scaleWidth = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.25);
const scaleHeight = (size) => scaleWidth(size);
const scaleFont = (size) => Math.min((width / guidelineBaseWidth) * size, size * 1.2);

const TEXT_DARK = '#0b1f3f';
const TEXT_MUTED = '#687382';
const WHITE = '#FFFFFF';
const BORDER_SOFT = 'rgba(15, 23, 42, 0.08)';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const isSameDay = (a, b) => (
  a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate()
);

const isBeforeDay = (a, b) => startOfDay(a).getTime() < startOfDay(b).getTime();
const isAfterDay = (a, b) => startOfDay(a).getTime() > startOfDay(b).getTime();

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

const buildYearRange = (centerYear) => {
  const start = centerYear - 50;
  return Array.from({ length: 101 }, (_, index) => start + index);
};

const DatePickerModal = ({
  visible = false,
  title = 'Select date',
  value,
  minimumDate,
  maximumDate,
  accentColor = TEXT_DARK,
  onClose,
  onConfirm,
}) => {
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [panel, setPanel] = useState('days');

  useEffect(() => {
    if (!visible) return;
    const initial = value instanceof Date && !Number.isNaN(value.getTime()) ? new Date(value) : new Date();
    setSelectedDate(initial);
    setViewYear(initial.getFullYear());
    setViewMonth(initial.getMonth());
    setPanel('days');
  }, [visible, value]);

  const maxDate = maximumDate instanceof Date && !Number.isNaN(maximumDate.getTime())
    ? startOfDay(maximumDate)
    : startOfDay(new Date());
  const minDate = minimumDate instanceof Date && !Number.isNaN(minimumDate.getTime())
    ? startOfDay(minimumDate)
    : null;

  const isDisabled = (date) => {
    const day = startOfDay(date);
    if (minDate && isBeforeDay(day, minDate)) return true;
    if (isAfterDay(day, maxDate)) return true;
    return false;
  };

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const leading = firstDay.getDay();
    const totalDays = getDaysInMonth(viewYear, viewMonth);
    const cells = [];

    for (let i = 0; i < leading; i += 1) {
      cells.push(null);
    }
    for (let day = 1; day <= totalDays; day += 1) {
      cells.push(new Date(viewYear, viewMonth, day));
    }
    return cells;
  }, [viewMonth, viewYear]);

  const yearRange = useMemo(() => buildYearRange(viewYear), [viewYear]);

  const goToPreviousMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((year) => year - 1);
      return;
    }
    setViewMonth((month) => month - 1);
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((year) => year + 1);
      return;
    }
    setViewMonth((month) => month + 1);
  };

  const handleDayPress = (date) => {
    if (!date || isDisabled(date)) return;
    setSelectedDate(date);
  };

  const handleMonthSelect = (monthIndex) => {
    setViewMonth(monthIndex);
    setPanel('days');
  };

  const handleYearSelect = (year) => {
    setViewYear(year);
    setPanel('months');
  };

  const handleConfirm = () => {
    if (isDisabled(selectedDate)) return;
    onConfirm?.(selectedDate);
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerAction}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{title}</Text>
            <TouchableOpacity onPress={handleConfirm} style={styles.headerAction}>
              <Text style={[styles.doneText, { color: accentColor }]}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.selectorRow}>
            <TouchableOpacity
              style={styles.selectorButton}
              onPress={() => setPanel((current) => (current === 'months' ? 'days' : 'months'))}
            >
              <Text style={[styles.selectorText, panel === 'months' && { color: accentColor }]}>
                {MONTHS[viewMonth]}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.selectorButton}
              onPress={() => setPanel((current) => (current === 'years' ? 'days' : 'years'))}
            >
              <Text style={[styles.selectorText, panel === 'years' && { color: accentColor }]}>
                {viewYear}
              </Text>
            </TouchableOpacity>
          </View>

          {panel === 'days' && (
            <>
              <View style={styles.monthNav}>
                <TouchableOpacity style={styles.navButton} onPress={goToPreviousMonth}>
                  <MaterialIcons name="chevron-left" size={24} color={TEXT_DARK} />
                </TouchableOpacity>
                <Text style={styles.monthNavLabel}>{MONTHS[viewMonth]} {viewYear}</Text>
                <TouchableOpacity style={styles.navButton} onPress={goToNextMonth}>
                  <MaterialIcons name="chevron-right" size={24} color={TEXT_DARK} />
                </TouchableOpacity>
              </View>

              <View style={styles.weekdayRow}>
                {WEEKDAYS.map((label) => (
                  <Text key={label} style={styles.weekdayText}>{label}</Text>
                ))}
              </View>

              <View style={styles.daysGrid}>
                {calendarDays.map((date, index) => {
                  if (!date) {
                    return <View key={`empty-${index}`} style={styles.dayCell} />;
                  }

                  const selected = isSameDay(date, selectedDate);
                  const disabled = isDisabled(date);
                  const today = isSameDay(date, new Date());

                  return (
                    <TouchableOpacity
                      key={date.toISOString()}
                      style={styles.dayCell}
                      disabled={disabled}
                      onPress={() => handleDayPress(date)}
                    >
                      <View
                        style={[
                          styles.dayBadge,
                          selected && { backgroundColor: accentColor },
                          today && !selected && styles.dayBadgeToday,
                          disabled && styles.dayBadgeDisabled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            selected && styles.dayTextSelected,
                            disabled && styles.dayTextDisabled,
                          ]}
                        >
                          {date.getDate()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {panel === 'months' && (
            <View style={styles.monthGrid}>
              {MONTHS.map((monthLabel, monthIndex) => {
                const active = monthIndex === viewMonth;
                return (
                  <TouchableOpacity
                    key={monthLabel}
                    style={[styles.monthItem, active && { backgroundColor: accentColor }]}
                    onPress={() => handleMonthSelect(monthIndex)}
                  >
                    <Text style={[styles.monthItemText, active && styles.monthItemTextActive]}>
                      {monthLabel.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {panel === 'years' && (
            <ScrollView style={styles.yearScroll} contentContainerStyle={styles.yearGrid}>
              {yearRange.map((year) => {
                const active = year === viewYear;
                return (
                  <TouchableOpacity
                    key={year}
                    style={[styles.yearItem, active && { backgroundColor: accentColor }]}
                    onPress={() => handleYearSelect(year)}
                  >
                    <Text style={[styles.yearItemText, active && styles.yearItemTextActive]}>
                      {year}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: WHITE,
    borderTopLeftRadius: scaleWidth(20),
    borderTopRightRadius: scaleWidth(20),
    paddingBottom: scaleHeight(24),
    paddingHorizontal: scaleWidth(16),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scaleHeight(14),
    borderBottomWidth: 1,
    borderBottomColor: BORDER_SOFT,
  },
  headerAction: {
    minWidth: scaleWidth(64),
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: scaleFont(15),
    fontWeight: '800',
    color: TEXT_DARK,
  },
  cancelText: {
    fontSize: scaleFont(14),
    color: TEXT_MUTED,
    fontWeight: '600',
  },
  doneText: {
    fontSize: scaleFont(14),
    fontWeight: '800',
    textAlign: 'right',
  },
  selectorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: scaleWidth(10),
    paddingTop: scaleHeight(14),
    paddingBottom: scaleHeight(6),
  },
  selectorButton: {
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleHeight(8),
    borderRadius: scaleWidth(12),
    backgroundColor: 'rgba(7, 27, 52, 0.06)',
  },
  selectorText: {
    fontSize: scaleFont(14),
    fontWeight: '800',
    color: TEXT_DARK,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: scaleHeight(8),
    marginBottom: scaleHeight(8),
  },
  navButton: {
    width: scaleWidth(36),
    height: scaleWidth(36),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 27, 52, 0.06)',
  },
  monthNavLabel: {
    fontSize: scaleFont(15),
    fontWeight: '800',
    color: TEXT_DARK,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: scaleHeight(6),
  },
  weekdayText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: scaleFont(11),
    fontWeight: '700',
    color: TEXT_MUTED,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: scaleHeight(8),
  },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: scaleHeight(4),
  },
  dayBadge: {
    width: scaleWidth(34),
    height: scaleWidth(34),
    borderRadius: scaleWidth(17),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeToday: {
    borderWidth: 1,
    borderColor: BORDER_SOFT,
  },
  dayBadgeDisabled: {
    opacity: 0.35,
  },
  dayText: {
    fontSize: scaleFont(13),
    fontWeight: '700',
    color: TEXT_DARK,
  },
  dayTextSelected: {
    color: WHITE,
  },
  dayTextDisabled: {
    color: TEXT_MUTED,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scaleWidth(8),
    paddingVertical: scaleHeight(12),
  },
  monthItem: {
    width: (width - scaleWidth(64)) / 3,
    paddingVertical: scaleHeight(12),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    backgroundColor: 'rgba(7, 27, 52, 0.05)',
  },
  monthItemText: {
    fontSize: scaleFont(13),
    fontWeight: '700',
    color: TEXT_DARK,
  },
  monthItemTextActive: {
    color: WHITE,
  },
  yearScroll: {
    maxHeight: scaleHeight(280),
    marginTop: scaleHeight(8),
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scaleWidth(8),
    paddingBottom: scaleHeight(8),
  },
  yearItem: {
    width: (width - scaleWidth(64)) / 4,
    paddingVertical: scaleHeight(10),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    backgroundColor: 'rgba(7, 27, 52, 0.05)',
  },
  yearItemText: {
    fontSize: scaleFont(13),
    fontWeight: '700',
    color: TEXT_DARK,
  },
  yearItemTextActive: {
    color: WHITE,
  },
});

export default DatePickerModal;
