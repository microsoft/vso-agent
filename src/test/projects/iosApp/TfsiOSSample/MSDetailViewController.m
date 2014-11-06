// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// ----------------------------------------------------------------------------
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

#import "MSDetailViewController.h"

@interface MSDetailViewController ()
@property (strong, nonatomic) UIPopoverController *masterPopoverController;
- (void)configureView;
@end

@implementation MSDetailViewController

- (void)dealloc
{
    [_detailItem release];
    [_urlButton release];
    [_masterPopoverController release];
    [super dealloc];
}

#pragma mark - Managing the detail item

- (void)setDetailItem:(MSWebReference*)newDetailItem
{
    NSLog(@"DetailView::setDetailItem: %@", newDetailItem.description);
    if (_detailItem != newDetailItem) {
        [_detailItem release];
        _detailItem = [newDetailItem retain];

        // Update the view.
        [self configureView];
    }

    if (self.masterPopoverController != nil) {
        [self.masterPopoverController dismissPopoverAnimated:YES];
    }        
}

- (void)configureView
{
    // Update the user interface for the detail item.

    if (self.detailItem) {
        self.title = self.detailItem.resourceName;
        [self.urlButton setTitle:self.detailItem.resourceURL.description forState:UIControlStateNormal];
        [self.webView loadRequest:[NSURLRequest requestWithURL:self.detailItem.resourceURL]];
    }
}

- (void)viewDidLoad
{
    NSLog(@"MSDetailsViewController::viewDidLoad");    
    [super viewDidLoad];
    [self.webView setDelegate:self];
    
    // we create the loading view but don't add it to the view hierarchy
    // before we load the web view request, we add and on complete, we remove
    CGRect activityFrame = CGRectMake(0, 0, 100, 100);
    MSLoadingView *loading = [[[MSLoadingView alloc] initWithFrame:activityFrame] autorelease];
    [loading setCenter:[[self view] center]];
    [self setActivityView:loading];
    
    [self configureView];
}

- (void)didReceiveMemoryWarning
{
    [super didReceiveMemoryWarning];
    // Dispose of any resources that can be recreated.
}

- (id)initWithNibName:(NSString *)nibNameOrNil bundle:(NSBundle *)nibBundleOrNil
{
    self = [super initWithNibName:nibNameOrNil bundle:nibBundleOrNil];
    if (self) {
        self.title = @"";
    }
    return self;
}
							
#pragma mark - Split view

- (void)splitViewController:(UISplitViewController *)splitController willHideViewController:(UIViewController *)viewController withBarButtonItem:(UIBarButtonItem *)barButtonItem forPopoverController:(UIPopoverController *)popoverController
{
    barButtonItem.title = NSLocalizedString(@"TFS & iOS", @"TFS & iOS");
    [self.navigationItem setLeftBarButtonItem:barButtonItem animated:YES];
    self.masterPopoverController = popoverController;
}

- (void)splitViewController:(UISplitViewController *)splitController willShowViewController:(UIViewController *)viewController invalidatingBarButtonItem:(UIBarButtonItem *)barButtonItem
{
    // Called when the view is shown again in the split view, invalidating the button and popover controller.
    [self.navigationItem setLeftBarButtonItem:nil animated:YES];
    self.masterPopoverController = nil;
}

///////////////////////////////////////////////////////////////////////////
#pragma mark -
#pragma mark UIWebViewDelegate
#pragma mark -
///////////////////////////////////////////////////////////////////////////

- (void) webViewDidStartLoad:(UIWebView *)webView {
    NSLog(@"webViewDidStartLoad");
    [[self view] addSubview:[self activityView]];
}

- (void) webViewDidFinishLoad:(UIWebView *)webView {
    NSLog(@"webViewDidFinishLoad");
    [[self activityView] removeFromSuperview];
}

///////////////////////////////////////////////////////////////////////////
#pragma mark -
#pragma mark Actions
#pragma mark -
///////////////////////////////////////////////////////////////////////////
- (IBAction)clickUrl: (id)sender
{
    [[UIApplication sharedApplication] openURL:self.detailItem.resourceURL];
}

@end
