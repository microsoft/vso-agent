// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#import <UIKit/UIKit.h>
#import "MSWebReference.h"
#import "MSLoadingView.h"

@interface MSDetailViewController : UIViewController <UISplitViewControllerDelegate, UIWebViewDelegate>

@property (strong, nonatomic) MSWebReference *detailItem;

@property (strong, nonatomic) IBOutlet UIButton *urlButton;
@property (strong, nonatomic) IBOutlet UIWebView *webView;
@property (retain, nonatomic) MSLoadingView * activityView;

- (IBAction)clickUrl: (id)sender;

@end
