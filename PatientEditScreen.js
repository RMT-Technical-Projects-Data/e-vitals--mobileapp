import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    KeyboardAvoidingView,
    Platform,
    Dimensions
} from 'react-native';
import { colors, fonts } from './config/globall';

const { width, height } = Dimensions.get('window');
const scaleWidth = (size) => (width / 375) * size;
const scaleHeight = (size) => (height / 812) * size;

const PatientEditForm = ({ navigation }) => {
    const [step, setStep] = useState(1);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [focusedField, setFocusedField] = useState(null);

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                style={styles.container}
                contentContainerStyle={{ paddingBottom: scaleHeight(30) }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.headerRow}>
                    <TouchableOpacity
                        onPress={() => {
                            if (step === 1) {
                                navigation.goBack();
                            } else {
                                setStep(1);
                            }
                        }}
                    >
                        <Image
                            source={require('./android/app/src/assets/images/back.png')}
                            style={styles.backIcon}
                        />
                    </TouchableOpacity>

                    <Text style={styles.header}>Edit Patient</Text>
                </View>

                <View style={styles.section}>
                    {step === 1 ? (
                        <>
                            {[
                                { key: 'title', label: 'Title', placeholder: 'Enter title' },
                                { key: 'firstName', label: 'First Name', placeholder: 'Enter first name' },
                                { key: 'middleInitial', label: 'Middle Initial', placeholder: 'Enter middle initial' },
                                { key: 'lastName', label: 'Last Name', placeholder: 'Enter last name' },
                                { key: 'permanentAddress', label: 'Permanent Address', placeholder: 'Enter permanent address', multiline: true },
                                { key: 'temporaryAddress', label: 'Temporary Address', placeholder: 'Enter temporary address', multiline: true },
                                { key: 'city', label: 'City', placeholder: 'Enter city' },
                                { key: 'state', label: 'State', placeholder: 'Enter state' },
                                { key: 'zipCode', label: 'Zip Code', placeholder: 'Enter zip code', keyboardType: 'numeric' },
                            ].map((field, index) => (
                                <View key={index} style={styles.inputGroup}>
                                    <Text style={styles.label}>{field.label}</Text>
                                    <TextInput
                                        style={[
                                            styles.input,
                                            field.multiline && { height: scaleHeight(80), textAlignVertical: 'top' },
                                            focusedField === field.key ? styles.inputFocused : styles.inputUnfocused
                                        ]}
                                        placeholder={field.placeholder}
                                        multiline={field.multiline || false}
                                        keyboardType={field.keyboardType || 'default'}
                                        placeholderTextColor={colors.textSecondary}
                                        onFocus={() => setFocusedField(field.key)}
                                        onBlur={() => setFocusedField(null)}
                                    />
                                </View>
                            ))}

                            {/* Next Button */}
                            <TouchableOpacity style={styles.fullWidthButton} onPress={() => setStep(2)}>
                                <Text style={styles.fullWidthButtonText}>Next</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            {/* Step 2 */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Email</Text>
                                <TextInput
                                    style={[
                                        styles.input,
                                        focusedField === 'email' ? styles.inputFocused : styles.inputUnfocused
                                    ]}
                                    placeholder="Enter email"
                                    keyboardType="email-address"
                                    placeholderTextColor={colors.textSecondary}
                                    onFocus={() => setFocusedField('email')}
                                    onBlur={() => setFocusedField(null)}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Username</Text>
                                <TextInput
                                    style={[
                                        styles.input,
                                        focusedField === 'username' ? styles.inputFocused : styles.inputUnfocused
                                    ]}
                                    placeholder="Enter username"
                                    placeholderTextColor={colors.textSecondary}
                                    onFocus={() => setFocusedField('username')}
                                    onBlur={() => setFocusedField(null)}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Password</Text>
                                <View style={[
                                    styles.passwordContainer,
                                    focusedField === 'password' ? styles.inputFocused : styles.inputUnfocused
                                ]}>
                                    <TextInput
                                        style={styles.passwordInput}
                                        secureTextEntry={!showPassword}
                                        placeholder="Enter password"
                                        placeholderTextColor={colors.textSecondary}
                                        onFocus={() => setFocusedField('password')}
                                        onBlur={() => setFocusedField(null)}
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                        <Image
                                            source={
                                                showPassword
                                                    ? require('./android/app/src/assets/images/eye-open.png')
                                                    : require('./android/app/src/assets/images/eye-close.png')
                                            }
                                            style={styles.eyeIcon}
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Confirm Password</Text>
                                <View style={[
                                    styles.passwordContainer,
                                    focusedField === 'confirmPassword' ? styles.inputFocused : styles.inputUnfocused
                                ]}>
                                    <TextInput
                                        style={styles.passwordInput}
                                        secureTextEntry={!showConfirmPassword}
                                        placeholder="Confirm password"
                                        placeholderTextColor={colors.textSecondary}
                                        onFocus={() => setFocusedField('confirmPassword')}
                                        onBlur={() => setFocusedField(null)}
                                    />
                                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                                        <Image
                                            source={
                                                showConfirmPassword
                                                    ? require('./android/app/src/assets/images/eye-open.png')
                                                    : require('./android/app/src/assets/images/eye-close.png')
                                            }
                                            style={styles.eyeIcon}
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Two Way Authentication</Text>
                                <TextInput
                                    style={[
                                        styles.input,
                                        focusedField === 'twoAuth' ? styles.inputFocused : styles.inputUnfocused
                                    ]}
                                    placeholder="Enter status"
                                    placeholderTextColor={colors.textSecondary}
                                    onFocus={() => setFocusedField('twoAuth')}
                                    onBlur={() => setFocusedField(null)}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Status</Text>
                                <TextInput
                                    style={[
                                        styles.input,
                                        focusedField === 'status' ? styles.inputFocused : styles.inputUnfocused
                                    ]}
                                    placeholder="Enter status"
                                    placeholderTextColor={colors.textSecondary}
                                    onFocus={() => setFocusedField('status')}
                                    onBlur={() => setFocusedField(null)}
                                />
                            </View>

                            {/* Buttons */}
                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    style={[styles.buttonBase, styles.cancelButton]}
                                    onPress={() => navigation.goBack()}
                                >
                                    <Text style={styles.cancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.buttonBase, styles.saveButton]}>
                                    <Text style={styles.saveText}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: scaleWidth(15),
        backgroundColor: colors.background
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: scaleHeight(15),
    },
    backIcon: {
        width: scaleWidth(20),
        height: scaleWidth(20),
        tintColor: colors.textPrimary,
        resizeMode: 'contain'
    },
    header: {
        ...fonts.heading,
        textAlign: 'right',
        marginRight: scaleWidth(10)
    },
    section: { marginBottom: scaleHeight(20) },
    inputGroup: { marginBottom: scaleHeight(15) },
    label: {
        ...fonts.label,
        marginBottom: scaleHeight(5)
    },
    input: {
        borderRadius: scaleWidth(8),
        paddingVertical: scaleHeight(10),
        paddingHorizontal: scaleWidth(10),
        backgroundColor: colors.textWhite,
        ...fonts.inputText
    },
    inputUnfocused: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    inputFocused: {
        borderWidth: 2,
        borderColor: 'black',
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: scaleWidth(8),
        backgroundColor: colors.textWhite,
        paddingHorizontal: scaleWidth(10)
    },
    passwordInput: {
        flex: 1,
        paddingVertical: scaleHeight(10),
        ...fonts.inputText
    },
    eyeIcon: {
        width: scaleWidth(20),
        height: scaleWidth(20),
        tintColor: colors.textPrimary,
        resizeMode: 'contain'
    },
    fullWidthButton: {
        backgroundColor: colors.primaryButton,
        padding: scaleHeight(12),
        borderRadius: scaleWidth(8),
        marginTop: scaleHeight(15),
        width: '100%',
        alignItems: 'center'
    },
    fullWidthButtonText: {
        ...fonts.buttonText(colors.textWhite)
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        marginTop: scaleHeight(20)
    },
    buttonBase: {
    flex: 1,
    height: scaleHeight(40),
    borderRadius: scaleHeight(22.5), // button height ka aadha = fully rounded
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: scaleWidth(19)
},

    cancelButton: {
        borderWidth: 1,
        borderColor: colors.textBlack,
        backgroundColor: colors.textWhite
    },
    saveButton: {
        backgroundColor: colors.primaryButton
    },
    cancelText: {
        ...fonts.buttonText(colors.textBlack, 'small',)
    },
    saveText: {
        ...fonts.buttonText(colors.textWhite, 'small')
    }
});

export default PatientEditForm;
