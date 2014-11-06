//
//  MSSampleTests.m
//  TfsiOSSample
//
//  Created by Bryan MacFarlane on 9/30/14.
//  Copyright (c) 2014 Microsoft Corporation. All rights reserved.
//

#import <UIKit/UIKit.h>
#import <XCTest/XCTest.h>
#import "MSWebReferenceModel.h"
#import "MSWebReference.h"

@interface MSSampleTests : XCTestCase

@end

@implementation MSSampleTests

- (void)setUp {
    [super setUp];
    // Put setup code here. This method is called before the invocation of each test method in the class.
}

- (void)tearDown {
    // Put teardown code here. This method is called after the invocation of each test method in the class.
    [super tearDown];
}

- (void)testAllocReleaseWebRefModel {
    MSWebReferenceModel *webRefModel = [[MSWebReferenceModel alloc] init];
    [webRefModel release];
}

- (void)testAllocWebRef {
    MSWebReference *webRef = [[MSWebReference alloc] initWithName:@"Microsoft" URL:@"http://microsoft.com"];
    [webRef release];
}

@end
