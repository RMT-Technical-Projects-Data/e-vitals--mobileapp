import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../config/globall';
import { scale, verticalScale } from 'react-native-size-matters';

const { width, height } = Dimensions.get('window');

const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

const scaleWidth = size => (width / guidelineBaseWidth) * size;
const scaleHeight = size => (height / guidelineBaseHeight) * size;
const scaleFont = size => scaleWidth(size);

const HEADER_COLOR = colors.primaryButton || '#11224D';
const WHITE = '#FFFFFF';

const FollowUp = ({ navigation }) => {
  const [followUpTemplates, setFollowUpTemplates] = useState([
    { 
      id: 1, 
      name: 'Normal BP', 
      content: 'This is the content for Normal BP template. It includes standard blood pressure follow-up procedures.',
      isVisible: true 
    },
    { 
      id: 2, 
      name: 'Emergency Follow-up', 
      content: 'Emergency protocol for critical situations requiring immediate attention.',
      isVisible: false 
    }
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    content: ''
  });

  const toggleTemplateVisibility = (id) => {
    setFollowUpTemplates(prev => 
      prev.map(template => 
        template.id === id 
          ? { ...template, isVisible: !template.isVisible }
          : template
      )
    );
  };

  const handleEditTemplate = (id) => {
    const template = followUpTemplates.find(t => t.id === id);
    setNewTemplate({
      name: template.name,
      content: template.content
    });
    setShowAddTemplateModal(true);
  };

  const handleDeleteTemplate = (id) => {
    Alert.alert(
      'Delete Template',
      'Are you sure you want to delete this template?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            setFollowUpTemplates(prev => prev.filter(template => template.id !== id));
            alert('Template deleted successfully!');
          }
        }
      ]
    );
  };

  const handleAddTemplate = () => {
    if (newTemplate.name.trim() && newTemplate.content.trim()) {
      const newTemplateObj = {
        id: Date.now(),
        name: newTemplate.name,
        content: newTemplate.content,
        isVisible: false
      };
      setFollowUpTemplates(prev => [...prev, newTemplateObj]);
      setNewTemplate({ name: '', content: '' });
      setShowAddTemplateModal(false);
      alert('Template added successfully!');
    } else {
      alert('Please fill in both template name and content');
    }
  };

  const filteredTemplates = followUpTemplates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.fullScreenContainer}>
        {/* Status Bar */}
        {/* <StatusBar backgroundColor={HEADER_COLOR} barStyle="light-content" /> */}
        <StatusBar barStyle="default" />


        <View style={styles.mainContainer}>
          {/* Header with Back Button - Dark Curved Section */}
          <View style={styles.topDarkSection}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.backButtonText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Follow-up Templates</Text>
              <View style={styles.headerSpacer} />
            </View>
          </View>

          {/* White section (Body section) */}
          <View style={styles.bottomLightSection}>
            <KeyboardAvoidingView
              style={styles.keyboardContainer}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <ScrollView 
                style={styles.scrollViewStyle}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Search and Add Section */}
                <View style={styles.searchAddContainer}>
                  <View style={styles.searchContainer}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search templates..."
                      placeholderTextColor={colors.textSecondary}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity 
                        style={styles.clearButton}
                        onPress={() => setSearchQuery('')}
                      >
                        <Text style={styles.clearButtonText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity 
                    style={styles.addTemplateButton}
                    onPress={() => setShowAddTemplateModal(true)}
                  >
                    <Text style={styles.addButtonText}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* Templates List */}
                <View style={styles.templatesContainer}>
                  <Text style={styles.templatesCount}>
                    {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} found
                  </Text>

                  {filteredTemplates.map(template => (
                    <View key={template.id} style={styles.templateCard}>
                      <View style={styles.templateHeader}>
                        <View style={styles.templateInfo}>
                          <Text style={styles.templateName}>{template.name}</Text>
                          <Text style={styles.templateStatus}>
                            {template.isVisible ? 'Visible' : 'Hidden'}
                          </Text>
                        </View>
                        <View style={styles.templateActions}>
                          <TouchableOpacity 
                            style={[styles.templateActionButton, styles.visibilityButton]}
                            onPress={() => toggleTemplateVisibility(template.id)}
                          >
                            <Image 
                              source={
                                template.isVisible 
                                  ? require('../../assets/images/batch_04/eye-open.png')
                                  : require('../../assets/images/batch_04/eye-close.png')
                              } 
                              style={styles.templateActionIcon}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.templateActionButton, styles.editButton]}
                            onPress={() => handleEditTemplate(template.id)}
                          >
                            <Image 
                              source={require('../../assets/images/batch_03/edit.png')} 
                              style={styles.templateActionIcon}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.templateActionButton, styles.deleteButton]}
                            onPress={() => handleDeleteTemplate(template.id)}
                          >
                            <Image 
                              source={require('../../assets/images/batch_02/delete.png')} 
                              style={styles.templateActionIcon}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                      
                      {template.isVisible && (
                        <View style={styles.templateContent}>
                          <Text style={styles.templateContentText}>{template.content}</Text>
                        </View>
                      )}
                    </View>
                  ))}

                  {filteredTemplates.length === 0 && (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>No templates found</Text>
                      <Text style={styles.emptyStateSubtext}>
                        {searchQuery ? 'Try adjusting your search' : 'Create your first template to get started'}
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </View>

        {/* Add Template Modal */}
        <Modal
          visible={showAddTemplateModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAddTemplateModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {newTemplate.name ? 'Edit Template' : 'New Template'}
              </Text>
              
              {/* Template Name Input Card */}
              <View style={styles.inputCard}>
                <Text style={styles.inputLabel}>Template Name</Text>
                <View style={styles.inputFieldContainer}>
                  <TextInput
                    style={styles.cardInput}
                    placeholder="Enter template name"
                    placeholderTextColor={colors.textSecondary}
                    value={newTemplate.name}
                    onChangeText={(text) => setNewTemplate(prev => ({ ...prev, name: text }))}
                  />
                </View>
              </View>

              {/* Template Content Input Card */}
              <View style={styles.inputCard}>
                <Text style={styles.inputLabel}>Template Content</Text>
                <View style={styles.inputFieldContainer}>
                  <TextInput
                    style={[styles.cardInput, styles.cardTextArea]}
                    placeholder="Enter template content..."
                    placeholderTextColor={colors.textSecondary}
                    value={newTemplate.content}
                    onChangeText={(text) => setNewTemplate(prev => ({ ...prev, content: text }))}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setNewTemplate({ name: '', content: '' });
                    setShowAddTemplateModal(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.okButton]}
                  onPress={handleAddTemplate}
                >
                  <Text style={styles.okButtonText}>
                    {newTemplate.name ? 'Update' : 'Create'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

export default FollowUp;

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: HEADER_COLOR,
  },
  mainContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: HEADER_COLOR,
  },

  // --- Header Styles (Matching NotificationSettings) ---
  topDarkSection: {
    backgroundColor: HEADER_COLOR,
    height: scaleHeight(120),
    borderBottomLeftRadius: scaleWidth(35),
    borderBottomRightRadius: scaleWidth(35),
    paddingBottom: scaleHeight(10),
    justifyContent: 'flex-start',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(20),
    paddingTop: scaleHeight(20),
  },
  backButton: {
  padding: 12, // Removed scaleWidth
  justifyContent: 'center',
  alignItems: 'left',
  minHeight: 55, // Removed scaleHeight
  minWidth: 55, // Removed scaleWidth
},
  backButtonText: {
    fontSize: scaleFont(35),
    color: WHITE,
    fontWeight: '300',
  },
  // headerTitle: {
  //   fontSize: scaleFont(24),
  //   // fontWeight: '800',
  //   fontFamily: 'Roboto-Bold',
  //   color: WHITE,
  //   textAlign: 'center',
  //   flex: 1,
  //   marginLeft: scaleWidth(5),
  // },
  headerTitle: {
  fontSize: scaleFont(22),
  fontWeight: Platform.OS === 'ios' ? '900' : 'bold',
  color: WHITE,
  textAlign: 'center',
  flex: 1,
  marginLeft: scaleWidth(5),
  ...Platform.select({
    android: {
      includeFontPadding: false,
      fontFamily: 'sans-serif-condensed', // Android system font
    },
  }),
},
  headerSpacer: {
    width: scaleWidth(36),
  },

  // --- Body Styles (Matching NotificationSettings) ---
  bottomLightSection: {
    flex: 1,
    backgroundColor: WHITE,
    borderTopLeftRadius: scaleWidth(35),
    borderTopRightRadius: scaleWidth(35),
    marginTop: -scaleWidth(15),
    paddingTop: scaleWidth(20),
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollViewStyle: {
    flex: 1,
  },
  scrollContent: { 
    paddingHorizontal: scaleWidth(20), 
    paddingVertical: verticalScale(20),
    flexGrow: 1,
  },

  // --- Search and Add Section ---
  searchAddContainer: {
    flexDirection: 'row',
    gap: scaleWidth(12),
    marginBottom: verticalScale(20),
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: scaleWidth(12),
    paddingHorizontal: scaleWidth(16),
    height: verticalScale(52),
  },
  searchInput: {
    flex: 1,
    ...fonts.paragraph,
    fontSize: scaleFont(16),
    paddingVertical: verticalScale(12),
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  clearButton: {
    width: scaleWidth(24),
    height: scaleWidth(24),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.borderLight,
    borderRadius: scaleWidth(12),
  },
  clearButtonText: {
    fontSize: scaleFont(14),
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  addTemplateButton: {
    backgroundColor: HEADER_COLOR,
    paddingHorizontal: scaleWidth(20),
    paddingVertical: verticalScale(12),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    ...fonts.buttonText(colors.textWhite),
    fontSize: scaleFont(14),
    fontWeight: '700',
  },

  // --- Templates List ---
  templatesContainer: {
    flex: 1,
  },
  templatesCount: {
    ...fonts.paragraph,
    fontSize: scaleFont(14),
    color: colors.textSecondary,
    marginBottom: verticalScale(16),
  },
  templateCard: {
    backgroundColor: colors.white,
    borderRadius: scaleWidth(16),
    padding: scaleWidth(20),
    marginBottom: verticalScale(16),
    borderWidth: 1,
    borderColor: colors.borderLight,
    // Removed shadow properties
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  templateInfo: {
    flex: 1,
    marginRight: scaleWidth(12),
  },
  templateName: {
    ...fonts.subHeading,
    fontSize: scaleFont(18),
    fontWeight: '700',
    marginBottom: verticalScale(4),
    color: colors.textPrimary,
  },
  templateStatus: {
    ...fonts.paragraph,
    fontSize: scaleFont(12),
    color: colors.textSecondary,
    fontWeight: '500',
  },
  templateActions: {
    flexDirection: 'row',
    gap: scaleWidth(8),
  },
  templateActionButton: {
    width: scaleWidth(44),
    height: scaleWidth(44),
    borderRadius: scaleWidth(10),
    alignItems: 'center',
    justifyContent: 'center',
    padding: scaleWidth(8),
  },
  templateActionIcon: {
    width: scaleWidth(22),
    height: scaleWidth(22),
    tintColor: HEADER_COLOR, // Changed to match settings screen icon color
  },
  visibilityButton: {
    backgroundColor: HEADER_COLOR + '15', // Semi-transparent background like settings screen
  },
  editButton: {
    backgroundColor: HEADER_COLOR + '15', // Semi-transparent background like settings screen
  },
  deleteButton: {
    backgroundColor: HEADER_COLOR + '15', // Semi-transparent background like settings screen
  },
  templateContent: {
    marginTop: verticalScale(12),
    padding: scaleWidth(16),
    backgroundColor: colors.backgroundLight,
    borderRadius: scaleWidth(8),
    borderLeftWidth: 4,
    borderLeftColor: HEADER_COLOR,
  },
  templateContentText: {
    ...fonts.paragraph,
    fontSize: scaleFont(14),
    color: colors.textSecondary,
    lineHeight: scaleFont(20),
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(60),
  },
  emptyStateText: {
    ...fonts.subHeading,
    fontSize: scaleFont(18),
    color: colors.textSecondary,
    marginBottom: verticalScale(8),
  },
  emptyStateSubtext: {
    ...fonts.paragraph,
    fontSize: scaleFont(14),
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // --- Modal Styles with Card Design ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scaleWidth(20),
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: scaleWidth(20),
    padding: scaleWidth(24),
    width: '100%',
    maxWidth: scaleWidth(400),
    borderWidth: 1,
    borderColor: colors.borderLight,
    // Removed shadow properties
  },
  modalTitle: {
    ...fonts.subHeading,
    fontSize: scaleFont(20),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: verticalScale(24),
    color: colors.textPrimary,
  },

  // Input Cards for Template Creation
  inputCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: scaleWidth(12),
    padding: scaleWidth(16),
    marginBottom: verticalScale(16),
    // Removed shadow properties
  },
  inputLabel: {
    ...fonts.subHeading,
    fontSize: scaleFont(16),
    marginBottom: verticalScale(8),
    color: colors.textPrimary,
    fontWeight: '600',
  },
  inputFieldContainer: {
    backgroundColor: colors.white,
    borderRadius: scaleWidth(8),
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: scaleWidth(12),
    paddingVertical: scaleWidth(8),
  },
  cardInput: {
    backgroundColor: colors.white,
    ...fonts.paragraph,
    fontSize: scaleFont(16),
    color: colors.textPrimary,
    backgroundColor: colors.white,
    minHeight: verticalScale(20),
  },
  cardTextArea: {
    minHeight: verticalScale(100),
    textAlignVertical: 'top',
  },

  // Modal Buttons
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scaleWidth(12),
    marginTop: verticalScale(8),
  },
  modalButton: {
    flex: 1,
    paddingVertical: verticalScale(16),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButton: {
    backgroundColor: colors.white,
    borderColor: colors.borderLight,
  },
  cancelButtonText: {
    ...fonts.buttonText(colors.textSecondary),
    fontSize: scaleFont(16),
    fontWeight: '600',
  },
  okButton: {
    backgroundColor: HEADER_COLOR,
    borderColor: HEADER_COLOR,
  },
  okButtonText: {
    ...fonts.buttonText(colors.textWhite),
    fontSize: scaleFont(16),
    fontWeight: '700',
  },
});