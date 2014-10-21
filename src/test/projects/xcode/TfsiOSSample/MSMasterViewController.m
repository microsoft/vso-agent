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

#import "MSMasterViewController.h"

#import "MSDetailViewController.h"

@interface MSMasterViewController () {
    MSWebReferenceModel *_webRefModel;
}

- (void)loadModel;
@end

@implementation MSMasterViewController

- (id)initWithNibName:(NSString *)nibNameOrNil bundle:(NSBundle *)nibBundleOrNil
{
    NSLog(@"MSMasterViewController::initWithNibName");
    self = [super initWithNibName:nibNameOrNil bundle:nibBundleOrNil];
    if (self) {
        [self setEditing:NO animated:YES];        
        self.title = NSLocalizedString(@"TFS & iOS", @"TFS & iOS");
        self.clearsSelectionOnViewWillAppear = NO;
        self.contentSizeForViewInPopover = CGSizeMake(320.0, 600.0);
        
        [self loadModel];
    }
    return self;
}

- (void)loadModel
{
    NSLog(@"initializeModel");
    if (!_webRefModel)
    {
        _webRefModel = [[MSWebReferenceModel alloc] init];
        
        [_webRefModel addWebReferenceNamed:@"VisualStudio.com"
                             withURLString:@"http://www.visualstudio.com/"];

        [_webRefModel addWebReferenceNamed:@"XcodeBuild Man"
                             withURLString:@"https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man1/xcodebuild.1.html"];

        [_webRefModel addWebReferenceNamed:@"node.js"
                             withURLString:@"http://nodejs.org"];
        
        [_webRefModel addWebReferenceNamed:@"bharry"
                       withURLString:@"http://blogs.msdn.com/b/bharry"];
    }
}

- (void)initialize
{
    NSLog(@"_webRefModel.count: %ld", (long)_webRefModel.count);
    if (_webRefModel.count > 0) {
        MSWebReference *webRef = [_webRefModel webReferenceAtIndex:0];
        self.detailViewController.detailItem = webRef;
    }
}

- (void)dealloc
{
    [_detailViewController release];
    [_webRefModel release];
    [super dealloc];
}

- (void)viewDidLoad
{
    NSLog(@"MSMasterViewController::viewDidLoad");
    [super viewDidLoad];
}

- (void)didReceiveMemoryWarning
{
    [super didReceiveMemoryWarning];
}

///////////////////////////////////////////////////////////////////////////
#pragma mark -
#pragma mark UITableViewDelegate
#pragma mark -
///////////////////////////////////////////////////////////////////////////
- (NSInteger)numberOfSectionsInTableView:(UITableView *)tableView
{
    return 1;
}

- (NSInteger)tableView:(UITableView *)tableView numberOfRowsInSection:(NSInteger)section
{
    return _webRefModel.count;
}

- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath
{
    static NSString *CellIdentifier = @"Cell";
    
    UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:CellIdentifier];
    if (cell == nil)
    {
        cell = [[[UITableViewCell alloc] initWithStyle:UITableViewCellStyleDefault
                                         reuseIdentifier:CellIdentifier] autorelease];
    }

    MSWebReference *webRef = [_webRefModel webReferenceAtIndex:indexPath.row];
    cell.textLabel.text = [webRef description];
    return cell;
}

- (BOOL)tableView:(UITableView *)tableView canEditRowAtIndexPath:(NSIndexPath *)indexPath
{
    return NO ;
}

- (void)tableView:(UITableView *)tableView didSelectRowAtIndexPath:(NSIndexPath *)indexPath
{
    NSLog(@"selected: %ld", (long)[indexPath row]);
    _webRefModel.selectedIndex = indexPath.row;
    MSWebReference *webRef = [_webRefModel webReferenceAtIndex:indexPath.row];
    NSLog(@"selected: %@", [webRef description]);
    self.detailViewController.detailItem = webRef;
}

@end
