#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>

@interface FileExport : NSObject <RCTBridgeModule, UIDocumentPickerDelegate>
@end

@implementation FileExport {
  RCTPromiseResolveBlock _resolve;
  RCTPromiseRejectBlock _reject;
  UIDocumentPickerViewController *_picker;
  NSString *_savedName;
}

RCT_EXPORT_MODULE(FileExport);

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

RCT_EXPORT_METHOD(saveToDownloads:(NSString *)filename
                  mimeType:(NSString *)mimeType
                  base64Data:(NSString *)base64Data
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  (void)mimeType;
  if (_resolve != nil) {
    reject(@"E_SAVE_FILE", @"Another export is already in progress", nil);
    return;
  }

  NSError *nameError = nil;
  NSString *safeName = [self sanitizeFilename:filename error:&nameError];
  if (safeName == nil) {
    reject(@"E_SAVE_FILE", nameError.localizedDescription ?: @"Invalid export filename", nameError);
    return;
  }

  NSData *bytes = [[NSData alloc] initWithBase64EncodedString:base64Data
                                                      options:NSDataBase64DecodingIgnoreUnknownCharacters];
  if (bytes.length == 0) {
    reject(@"E_SAVE_FILE", @"The export file is empty", nil);
    return;
  }

  NSString *path = [NSTemporaryDirectory() stringByAppendingPathComponent:safeName];
  NSError *writeError = nil;
  if (![bytes writeToFile:path options:NSDataWritingAtomic error:&writeError]) {
    reject(@"E_SAVE_FILE", writeError.localizedDescription ?: @"Could not write the export file", writeError);
    return;
  }

  UIViewController *presenter = [self topViewController];
  if (presenter == nil) {
    reject(@"E_SAVE_FILE", @"Could not open the save dialog", nil);
    return;
  }

  NSURL *fileURL = [NSURL fileURLWithPath:path];
  UIDocumentPickerViewController *picker =
      [[UIDocumentPickerViewController alloc] initForExportingURLs:@[fileURL] asCopy:YES];
  picker.delegate = self;
  picker.modalPresentationStyle = UIModalPresentationFormSheet;

  _resolve = resolve;
  _reject = reject;
  _picker = picker;
  _savedName = safeName;
  [presenter presentViewController:picker animated:YES completion:nil];
}

- (void)documentPicker:(UIDocumentPickerViewController *)controller didPickDocumentsAtURLs:(NSArray<NSURL *> *)urls
{
  NSString *name = urls.firstObject.lastPathComponent;
  if (name.length == 0) {
    name = _savedName;
  }
  RCTPromiseResolveBlock resolve = _resolve;
  [self clearPending];
  if (resolve != nil) {
    resolve(name);
  }
}

- (void)documentPickerWasCancelled:(UIDocumentPickerViewController *)controller
{
  RCTPromiseRejectBlock reject = _reject;
  [self clearPending];
  if (reject != nil) {
    reject(@"E_CANCELLED", @"Export cancelled", nil);
  }
}

- (void)clearPending
{
  _resolve = nil;
  _reject = nil;
  _picker = nil;
  _savedName = nil;
}

- (NSString *)sanitizeFilename:(NSString *)filename error:(NSError **)error
{
  NSString *trimmed = [filename stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
  NSString *cleaned = [trimmed stringByReplacingOccurrencesOfString:@"[\\\\/:*?\"<>|]"
                                                        withString:@"_"
                                                           options:NSRegularExpressionSearch
                                                             range:NSMakeRange(0, trimmed.length)];
  if (![cleaned containsString:@"."]) {
    if (error != nil) {
      *error = [NSError errorWithDomain:@"FileExport"
                                   code:1
                               userInfo:@{NSLocalizedDescriptionKey : @"Export filename must include a file extension"}];
    }
    return nil;
  }
  return cleaned;
}

- (UIViewController *)topViewController
{
  UIWindow *window = nil;
  for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
    if (![scene isKindOfClass:[UIWindowScene class]]) {
      continue;
    }
    for (UIWindow *candidate in ((UIWindowScene *)scene).windows) {
      if (candidate.isKeyWindow) {
        window = candidate;
        break;
      }
    }
    if (window != nil) {
      break;
    }
  }
  if (window == nil) {
    window = UIApplication.sharedApplication.delegate.window;
  }

  UIViewController *controller = window.rootViewController;
  while (controller.presentedViewController != nil) {
    controller = controller.presentedViewController;
  }
  return controller;
}

@end
